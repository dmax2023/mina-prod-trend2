import { useEffect, useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Recipient = {
  id: string;
  name: string;
  email: string;
  enabled: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DestinatariosSimulacao() {
  const [lista, setLista] = useState<Recipient[]>([]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [receber, setReceber] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");

  async function carregar() {
    const { data, error } = await supabase
      .from("notification_recipients")
      .select("id, name, email, enabled")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Não foi possível carregar os destinatários.");
      return;
    }
    setLista(data ?? []);
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function adicionar(): Promise<void> {
    const n = nome.trim();
    const e = email.trim().toLowerCase();
    if (!n) return void toast.error("Informe o nome.");
    if (!e) return void toast.error("Informe o e-mail.");
    if (!EMAIL_RE.test(e)) return void toast.error("E-mail inválido.");
    if (lista.some((r) => r.email.toLowerCase() === e))
      return void toast.error("Este e-mail já está cadastrado.");

    setSalvando(true);
    const { error } = await supabase
      .from("notification_recipients")
      .insert({ name: n, email: e, enabled: receber });
    setSalvando(false);

    if (error) {
      toast.error(
        error.code === "23505" ? "Este e-mail já está cadastrado." : "Falha ao adicionar destinatário.",
      );
      return;
    }
    setNome("");
    setEmail("");
    setReceber(true);
    toast.success("Destinatário adicionado.");
    void carregar();
  }

  async function alternar(r: Recipient, valor: boolean) {
    setLista((old) => old.map((x) => (x.id === r.id ? { ...x, enabled: valor } : x)));
    const { error } = await supabase
      .from("notification_recipients")
      .update({ enabled: valor })
      .eq("id", r.id);
    if (error) {
      toast.error("Falha ao atualizar.");
      void carregar();
    }
  }

  async function salvarEdicao(id: string): Promise<void> {
    const n = editNome.trim();
    const e = editEmail.trim().toLowerCase();
    if (!n) return void toast.error("Informe o nome.");
    if (!EMAIL_RE.test(e)) return void toast.error("E-mail inválido.");
    if (lista.some((r) => r.id !== id && r.email.toLowerCase() === e))
      return void toast.error("Este e-mail já está cadastrado.");

    const { error } = await supabase
      .from("notification_recipients")
      .update({ name: n, email: e })
      .eq("id", id);
    if (error) {
      toast.error("Falha ao salvar alterações.");
      return;
    }
    setEditandoId(null);
    toast.success("Destinatário atualizado.");
    void carregar();
  }

  async function excluir(id: string) {
    const { error } = await supabase.from("notification_recipients").delete().eq("id", id);
    if (error) {
      toast.error("Falha ao excluir.");
      return;
    }
    toast.success("Destinatário removido.");
    void carregar();
  }

  return (
    <section className="mx-auto mt-4 max-w-7xl">
      <div className="panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em]">
          Destinatários das simulações
        </h2>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="dest-nome">Nome</Label>
            <Input
              id="dest-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do destinatário"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dest-email">E-mail</Label>
            <Input
              id="dest-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@dominio.com"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox
              checked={receber}
              onCheckedChange={(v) => setReceber(v === true)}
              aria-label="Receber notificações"
            />
            Receber notificações
          </label>
          <Button onClick={() => void adicionar()} disabled={salvando}>
            {salvando ? "Salvando..." : "Adicionar"}
          </Button>
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Destinatários cadastrados
          </h3>
          {lista.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum destinatário cadastrado.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                    <th className="py-2 pr-3">Nome</th>
                    <th className="py-2 pr-3">E-mail</th>
                    <th className="py-2 pr-3">Receber</th>
                    <th className="py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2 pr-3">
                        {editandoId === r.id ? (
                          <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
                        ) : (
                          r.name
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {editandoId === r.id ? (
                          <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                        ) : (
                          r.email
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <Checkbox
                          checked={r.enabled}
                          onCheckedChange={(v) => void alternar(r, v === true)}
                          aria-label={`Receber notificações de ${r.name}`}
                        />
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          {editandoId === r.id ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => void salvarEdicao(r.id)}
                                aria-label="Salvar"
                              >
                                <Check className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditandoId(null)}
                                aria-label="Cancelar"
                              >
                                <X className="size-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditandoId(r.id);
                                  setEditNome(r.name);
                                  setEditEmail(r.email);
                                }}
                                aria-label="Editar"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => void excluir(r.id)}
                                aria-label="Excluir"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
