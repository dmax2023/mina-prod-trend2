import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type MesConnectionRow = {
  id: string;
  name: string;
  baseUrl: string;
  endpoints: string[];
  tokenMasked: string;
  active: boolean;
  createdAt: string;
  lastSyncAt: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const mask = (t: string) => `••••${t.slice(-4)}`;

export const listConnections = createServerFn({ method: "GET" }).handler(
  async (): Promise<MesConnectionRow[]> => {
    const db = await admin();
    const { data, error } = await db
      .from("mes_connections")
      .select("id, name, base_url, endpoints, token, active, created_at, last_sync_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error("Falha ao carregar conexões.");
    return (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      baseUrl: c.base_url,
      endpoints: c.endpoints ?? [],
      tokenMasked: mask(c.token),
      active: c.active,
      createdAt: c.created_at,
      lastSyncAt: c.last_sync_at,
    }));
  },
);

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  baseUrl: z.string().trim().url().max(500),
  endpoints: z.array(z.string().trim().min(1).max(300)).min(1).max(10),
  token: z.string().trim().max(500),
});

export const saveConnection = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof saveSchema>) => saveSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; mensagem?: string }> => {
    const db = await admin();
    const campos = { name: data.name, base_url: data.baseUrl, endpoints: data.endpoints };
    if (data.id) {
      const upd = data.token ? { ...campos, token: data.token } : campos;
      const { error } = await db
        .from("mes_connections")
        .update({ ...upd, updated_at: new Date().toISOString() })
        .eq("id", data.id);
      return error ? { ok: false, mensagem: "Falha ao salvar conexão." } : { ok: true };
    }
    if (!data.token) return { ok: false, mensagem: "Informe o token/API key." };
    const { error } = await db.from("mes_connections").insert({ ...campos, token: data.token });
    return error ? { ok: false, mensagem: "Falha ao criar conexão." } : { ok: true };
  });

export const setConnectionActive = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; active: boolean }) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const db = await admin();
    // Apenas uma conexão ativa: desativa todas antes de ativar a nova.
    const off = await db.from("mes_connections").update({ active: false }).eq("active", true);
    if (off.error) return { ok: false };
    if (!data.active) return { ok: true };
    const { error } = await db.from("mes_connections").update({ active: true }).eq("id", data.id);
    return { ok: !error };
  });

export const deleteConnection = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const db = await admin();
    const { error } = await db.from("mes_connections").delete().eq("id", data.id);
    return { ok: !error };
  });

export const testConnection = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; mensagem: string }> => {
    const db = await admin();
    const { data: c } = await db
      .from("mes_connections")
      .select("id, name, base_url, token, endpoints, last_sync_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!c) return { ok: false, mensagem: "Conexão não encontrada." };
    const { fetchMes } = await import("./mes.server");
    const end = new Date();
    const start = new Date(end.getTime() - 86_400_000);
    const t0 = Date.now();
    const r = await fetchMes(
      { id: c.id, name: c.name, baseUrl: c.base_url, token: c.token, endpoints: c.endpoints ?? [], lastSyncAt: c.last_sync_at },
      "ProductionCount",
      start.toISOString(),
      end.toISOString(),
    );
    const ms = Date.now() - t0;
    if (!r.ok) return { ok: false, mensagem: r.error };
    const n = Array.isArray(r.json) ? r.json.length : 0;
    return { ok: true, mensagem: `Conexão OK — ${n} registros nas últimas 24h (${ms} ms).` };
  });
