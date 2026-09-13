import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const recipientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .refine((v) => EMAIL_RE.test(v), "E-mail inválido"),
});

export type Recipient = {
  id: string;
  name: string;
  email: string;
  enabled: boolean;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listRecipients = createServerFn({ method: "GET" }).handler(
  async (): Promise<Recipient[]> => {
    const supabaseAdmin = await admin();
    const { data, error } = await supabaseAdmin
      .from("notification_recipients")
      .select("id, name, email, enabled")
      .order("created_at", { ascending: true });
    if (error) throw new Error("Falha ao carregar destinatários.");
    return data ?? [];
  },
);

export const addRecipient = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; email: string; enabled: boolean }) =>
    z
      .object({ enabled: z.boolean() })
      .extend(recipientSchema.shape)
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; mensagem?: string }> => {
    const supabaseAdmin = await admin();
    const { error } = await supabaseAdmin.from("notification_recipients").insert({
      name: data.name,
      email: data.email,
      enabled: data.enabled,
    });
    if (error) {
      if (error.code === "23505") return { ok: false, mensagem: "Este e-mail já está cadastrado." };
      return { ok: false, mensagem: "Falha ao adicionar destinatário." };
    }
    return { ok: true };
  });

export const updateRecipient = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; name: string; email: string }) =>
    z.object({ id: z.string().uuid() }).extend(recipientSchema.shape).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; mensagem?: string }> => {
    const supabaseAdmin = await admin();
    const { error } = await supabaseAdmin
      .from("notification_recipients")
      .update({ name: data.name, email: data.email })
      .eq("id", data.id);
    if (error) {
      if (error.code === "23505") return { ok: false, mensagem: "Este e-mail já está cadastrado." };
      return { ok: false, mensagem: "Falha ao salvar alterações." };
    }
    return { ok: true };
  });

export const setRecipientEnabled = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; enabled: boolean }) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const supabaseAdmin = await admin();
    const { error } = await supabaseAdmin
      .from("notification_recipients")
      .update({ enabled: data.enabled })
      .eq("id", data.id);
    return { ok: !error };
  });

export const deleteRecipient = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const supabaseAdmin = await admin();
    const { error } = await supabaseAdmin
      .from("notification_recipients")
      .delete()
      .eq("id", data.id);
    return { ok: !error };
  });
