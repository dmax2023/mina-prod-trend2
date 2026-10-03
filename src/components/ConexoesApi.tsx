import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plug, Power, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  listConnections,
  saveConnection,
  setConnectionActive,
  deleteConnection,
  testConnection,
  type MesConnectionRow,
} from "@/lib/connections.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_ENDPOINTS = 10;
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR") : "—");

type Form = { id?: string; name: string; baseUrl: string; endpoints: string[]; token: string };
const VAZIO: Form = { name: "", baseUrl: "", endpoints: [""], token: "" };

export function ConexoesApi() {
  const qc = useQueryClient();
  const [lista, setLista] = useState<MesConnectionRow[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState<string | null>(null);

  const listar = useServerFn(listConnections);
  const salvarFn = useServerFn(saveConnection);
  const ativarFn = useServerFn(setConnectionActive);
  const excluirFn = useServerFn(deleteConnection);
  const testarFn = useServerFn(testConnection);

  async function carregar() {
    try {
      setLista(await listar());
    } catch {
      toast.error("Não foi possível carregar as conexões.");
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Troca de fonte: descarta todo o cache MES e força nova resolução da conexão ativa.
  async function trocarFonte() {
    await qc.cancelQueries({ queryKey: ["production"] });
    qc.removeQueries({ queryKey: ["production"] });
    await qc.invalidateQueries({ queryKey: ["mes-active-connection"] });
  }

  async function salvar(): Promise<void> {
    if (!form) return;
    const endpoints = form.endpoints.map((e) => e.trim()).filter(Boolean);
    if (!form.name.trim()) return void toast.error("Informe o nome da conexão.");
    if (!/^https?:\/\//.test(form.baseUrl.trim())) return void toast.error("URL base inválida.");
    if (endpoints.length === 0) return void toast.error("Informe ao menos um endpoint.");
    if (!form.id && !form.token.trim()) return void toast.error("Informe o token/API key.");
    setSalvando(true);
    const res = await salvarFn({ data: { ...form, endpoints } });
    setSalvando(false);
    if (!res.ok) return void toast.error(res.mensagem ?? "Falha ao salvar.");
    toast.success("Conexão salva.");
    const eraAtiva = lista.find((c) => c.id === form.id)?.active;
    setForm(null);
    await carregar();
    if (eraAtiva) await trocarFonte();
  }

  async function alternar(c: MesConnectionRow) {
    const res = await ativarFn({ data: { id: c.id, active: !c.active } });
    if (!res.ok) return void toast.error("Falha ao alterar a situação.");
    toast.success(c.active ? "Conexão desativada." : `"${c.name}" é agora a fonte oficial.`);
    await carregar();
    await trocarFonte();
  }

  async function excluir(c: MesConnectionRow) {
    if (!confirm(`Excluir a conexão "${c.name}"?`)) return;
    const res = await excluirFn({ data: { id: c.id } });
    if (!res.ok) return void toast.error("Falha ao excluir.");
    toast.success("Conexão removida.");
    await carregar();
    if (c.active) await trocarFonte();
  }

  async function testar(c: MesConnectionRow) {
    setTestando(c.id);
    try {
      const r = await testarFn({ data: { id: c.id } });
      if (r.ok) toast.success(r.mensagem);
      else toast.error(r.mensagem);
    } catch {
      toast.error("Falha na conexão MES");
    } finally {
      setTestando(null);
    }
  }

  return (
    <section className="mx-auto mt-4 max-w-7xl">
      <div className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em]">Conexões de API</h2>
          <Button size="sm" onClick={() => setForm({ ...VAZIO, endpoints: [""] })}>
            <Plus className="size-4" /> Nova conexão
          </Button>
        </div>

        {lista.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma conexão cadastrada.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 pr-3">Nome da conexão</th>
                  <th className="py-2 pr-3">URL da API</th>
                  <th className="py-2 pr-3">Endpoints</th>
                  <th className="py-2 pr-3">Token</th>
                  <th className="py-2 pr-3">Criada em</th>
                  <th className="py-2 pr-3">Última sincronização</th>
                  <th className="py-2 pr-3">Situação</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 align-top">
                    <td className="py-2 pr-3 font-medium">{c.name}</td>
                    <td className="py-2 pr-3 break-all">{c.baseUrl}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {c.endpoints.map((e) => (
                        <div key={e} className="whitespace-nowrap">GET {e}</div>
                      ))}
                    </td>
                    <td className="py-2 pr-3 font-mono">{c.tokenMasked}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmt(c.createdAt)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmt(c.lastSyncAt)}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={c.active ? "default" : "secondary"}>
                        {c.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" aria-label="Editar"
                          onClick={() => setForm({ id: c.id, name: c.name, baseUrl: c.baseUrl, endpoints: [...c.endpoints], token: "" })}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Testar"
                          disabled={testando === c.id} onClick={() => void testar(c)}>
                          <Plug className={`size-4 ${testando === c.id ? "animate-pulse" : ""}`} />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label={c.active ? "Desativar" : "Ativar"}
                          onClick={() => void alternar(c)}>
                          <Power className={`size-4 ${c.active ? "text-success" : ""}`} />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => void excluir(c)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar conexão" : "Nova conexão"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cx-nome">Nome da conexão</Label>
                <Input id="cx-nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cx-url">URL base da API</Label>
                <Input id="cx-url" placeholder="https://mina.com.br/integration" value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>GET Endpoints ({form.endpoints.length}/{MAX_ENDPOINTS})</Label>
                {form.endpoints.map((ep, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={ep} placeholder="/v1/ProductionCount/{startDate}/{endDate}"
                      onChange={(e) => {
                        const n = [...form.endpoints];
                        n[i] = e.target.value;
                        setForm({ ...form, endpoints: n });
                      }} />
                    <Button size="icon" variant="ghost" aria-label="Remover endpoint"
                      disabled={form.endpoints.length === 1}
                      onClick={() => setForm({ ...form, endpoints: form.endpoints.filter((_, j) => j !== i) })}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" disabled={form.endpoints.length >= MAX_ENDPOINTS}
                  onClick={() => setForm({ ...form, endpoints: [...form.endpoints, ""] })}>
                  <Plus className="size-4" /> Adicionar endpoint
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cx-token">Token/API Key</Label>
                <Input id="cx-token" type="password" autoComplete="off" value={form.token}
                  placeholder={form.id ? "Deixe vazio para manter o token atual" : ""}
                  onChange={(e) => setForm({ ...form, token: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={() => void salvar()} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
