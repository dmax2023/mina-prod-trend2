import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ProductionRecord } from "@/lib/mes.functions";
import { enviarSimulacao } from "@/lib/notifications.functions";
import { formatarNumero, prepararSerie, TODOS_WORK_CENTERS } from "@/lib/twin-math";
import {
  calcularProjecaoAutomatica,
  chaveAlerta,
  estoqueMinimo,
  ROTULO_ESTOQUE,
  ROTULO_PRODUCAO,
  validarConfig,
  type AutoConfig,
  type AutoSnapshot,
} from "@/lib/autoSimulation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STORAGE = "gd-simulador-automatico";
const MAX_VALOR = 9_999_999_999;
const JANELAS = [7, 15, 30, 60, 90, 180, 360];

const num = (v: string, min = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(MAX_VALOR, Math.max(min, n)) : min;
};

export function AutoSimulator({
  records,
  workCenters,
  workCenterAtual,
}: {
  records: ProductionRecord[];
  workCenters: string[];
  workCenterAtual: string;
}) {
  const [auto, setAuto] = useState(false);
  const [cfg, setCfg] = useState<AutoConfig>({
    workCenter: workCenterAtual,
    horizonte: 30,
    estoqueAtual: 0,
    estoqueMaximo: 100000,
    minimoModo: "auto",
    estoqueMinimoManual: 20000,
    consumoAtivo: false,
    janelaConsumo: 30,
    pctMinimo: 20,
    pctPreAlerta: 20,
    pctProducaoMin: 20,
    pctProducaoMax: 100,
  });
  const [avancado, setAvancado] = useState(false);
  const [snap, setSnap] = useState<AutoSnapshot | null>(null);
  const [ultimoEnvio, setUltimoEnvio] = useState<string | null>(null);
  const ultimaChave = useRef<string | null>(null);
  const enviando = useRef(false);
  const carregado = useRef(false);
  const enviarFn = useServerFn(enviarSimulacao);

  // Restaura preferências salvas (somente no navegador).
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(STORAGE) ?? "null");
      if (salvo) {
        setAuto(Boolean(salvo.auto));
        setCfg((c) => ({ ...c, ...salvo.cfg }));
        ultimaChave.current = salvo.ultimaChave ?? null;
      }
    } catch {
      /* preferências inválidas são ignoradas */
    }
    carregado.current = true;
  }, []);

  useEffect(() => {
    if (!carregado.current) return;
    localStorage.setItem(
      STORAGE,
      JSON.stringify({ auto, cfg, ultimaChave: ultimaChave.current }),
    );
  }, [auto, cfg, snap]);

  const set = <K extends keyof AutoConfig>(k: K, v: AutoConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  const serie = useMemo(
    () => prepararSerie(records, cfg.workCenter, 365),
    [records, cfg.workCenter],
  );
  const erro = validarConfig(cfg);

  function projetar() {
    const s = calcularProjecaoAutomatica(serie, cfg);
    if (s) setSnap(s);
    return s;
  }

  // Modo automático: acompanha cada nova sincronização; desligado preserva o último snapshot.
  useEffect(() => {
    if (!auto) return;
    const s = projetar();
    if (s) void avaliarAlerta(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, serie, cfg]);

  async function avaliarAlerta(s: AutoSnapshot) {
    const chave = chaveAlerta(s);
    if (chave === ultimaChave.current) return; // mesmo estado → sem e-mail repetido
    if (chave === null) {
      ultimaChave.current = null; // recuperação: libera futuros alertas
      return;
    }
    if (enviando.current) return;
    enviando.current = true;
    ultimaChave.current = chave;
    try {
      const res = await enviarFn({ data: { simulation: s } });
      if (res.ok) {
        setUltimoEnvio(`Alerta enviado para ${res.enviados} destinatário(s).`);
        toast.success("Alerta do Simulador Automático enviado.");
      } else if (res.motivo === "sem-destinatarios") {
        setUltimoEnvio("Nenhum destinatário habilitado em Notificações.");
      } else {
        ultimaChave.current = null;
        setUltimoEnvio(res.mensagem ?? "Falha ao enviar o alerta.");
      }
    } catch {
      ultimaChave.current = null;
      setUltimoEnvio("Falha ao enviar o alerta.");
    } finally {
      enviando.current = false;
    }
  }

  const eMin = estoqueMinimo(cfg);
  const risco = snap?.estadoEstoque.startsWith("RISCO");
  const proximo = snap?.estadoEstoque.startsWith("PROXIMO");

  return (
    <section className="mx-auto mt-4 max-w-7xl">
      <div className="panel space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em]">Simulador Automático</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              O que tende a acontecer com o estoque se o ritmo recente de produção continuar.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={auto} onCheckedChange={setAuto} />
            Modo automático {auto ? "LIGADO" : "DESLIGADO"}
          </label>
        </div>

        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Centro de trabalho</Label>
              <Select value={cfg.workCenter} onValueChange={(v) => set("workCenter", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS_WORK_CENTERS}>Todos</SelectItem>
                  {(workCenters.length ? workCenters : [workCenterAtual]).map((wc) => (
                    <SelectItem key={wc} value={wc}>
                      {wc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="auto-h">Projetar quantos dias à frente</Label>
              <Input
                id="auto-h"
                type="number"
                min={1}
                value={cfg.horizonte}
                onChange={(e) => set("horizonte", Math.round(num(e.target.value, 1)) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auto-e">Estoque disponível hoje</Label>
              <Input
                id="auto-e"
                type="number"
                min={0}
                value={cfg.estoqueAtual}
                onChange={(e) => set("estoqueAtual", num(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auto-max">Estoque máximo</Label>
              <Input
                id="auto-max"
                type="number"
                min={0}
                value={cfg.estoqueMaximo}
                onChange={(e) => set("estoqueMaximo", num(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Quanto cabe no estoque.</p>
            </div>
            <div className="space-y-2">
              <Label>Estoque mínimo</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={cfg.minimoModo === "auto" ? "default" : "outline"}
                  onClick={() => set("minimoModo", "auto")}
                >
                  Automático
                </Button>
                <Button
                  size="sm"
                  variant={cfg.minimoModo === "manual" ? "default" : "outline"}
                  onClick={() => set("minimoModo", "manual")}
                >
                  Manual
                </Button>
              </div>
              {cfg.minimoModo === "manual" ? (
                <Input
                  type="number"
                  min={0}
                  value={cfg.estoqueMinimoManual}
                  onChange={(e) => set("estoqueMinimoManual", num(e.target.value))}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {cfg.pctMinimo}% do máximo = {formatarNumero(eMin)} un.
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={cfg.consumoAtivo} onCheckedChange={(v) => set("consumoAtivo", v)} />
              Considerar saídas do estoque
            </label>
            {cfg.consumoAtivo ? (
              <div className="space-y-2">
                <Label>Período do histórico de saídas</Label>
                <Select
                  value={String(cfg.janelaConsumo)}
                  onValueChange={(v) => set("janelaConsumo", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JANELAS.map((j) => (
                      <SelectItem key={j} value={String(j)}>
                        {j} dias
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={() => setAvancado((a) => !a)}
            >
              {avancado ? "Ocultar" : "Mostrar"} configurações avançadas
            </button>
            {avancado ? (
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["pctMinimo", "Mínimo automático (% do máximo)"],
                    ["pctPreAlerta", "Aviso de proximidade (%)"],
                    ["pctProducaoMin", "Produção mínima (% da média)"],
                    ["pctProducaoMax", "Produção máxima (% da média)"],
                  ] as const
                ).map(([k, rotulo]) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs">{rotulo}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={k === "pctProducaoMax" ? 1000 : 100}
                      value={cfg[k]}
                      onChange={(e) =>
                        set(k, Math.min(k === "pctProducaoMax" ? 1000 : 99, num(e.target.value)))
                      }
                    />
                  </div>
                ))}
              </div>
            ) : null}
            {!auto ? (
              <Button className="w-full" onClick={projetar} disabled={Boolean(erro) || !records.length}>
                Atualizar projeção agora
              </Button>
            ) : null}
            {erro ? <p className="text-xs text-destructive">{erro}</p> : null}
          </div>

          {snap ? (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Situação</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      risco
                        ? "bg-destructive text-destructive-foreground"
                        : proximo
                          ? "bg-primary text-primary-foreground"
                          : "bg-success text-primary-foreground"
                    }`}
                  >
                    {risco ? "RISCO" : proximo ? "ATENÇÃO" : "OK"}
                  </span>
                  <span>
                    {ROTULO_ESTOQUE[snap.estadoEstoque]} • {ROTULO_PRODUCAO[snap.estadoProducao]}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <Info k="Estoque hoje" v={`${formatarNumero(snap.estoqueAtual)} un.`} />
                  <Info k="Mínimo / Máximo" v={`${formatarNumero(snap.estoqueMinimo)} / ${formatarNumero(snap.estoqueMaximo)}`} />
                  <Info k="Produção média (7 dias)" v={`${formatarNumero(snap.producaoRef)} un./dia`} />
                  <Info k="Produção mais recente" v={snap.producaoAtual === null ? "—" : `${formatarNumero(snap.producaoAtual)} un./dia`} />
                  <Info k="Faixa de produção" v={`${formatarNumero(snap.producaoMin)} – ${formatarNumero(snap.producaoMax)} un./dia`} />
                  <Info k="Saldo por dia" v={`${snap.saldoLiquido >= 0 ? "+" : ""}${formatarNumero(snap.saldoLiquido)} un.`} />
                  <Info k="Primeiro alerta" v={snap.evento} />
                  <Info k="Atualizado em" v={new Date(snap.geradoEm).toLocaleString("pt-BR")} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {snap.consumoAtivo
                    ? "Dados históricos de saídas do estoque indisponíveis na conexão MES — a projeção considera somente a produção; nenhum valor é inventado."
                    : "Projeção sem consumo: as saídas do estoque não estão sendo consideradas."}
                </p>
              </div>

              <div className="rounded-md border border-border p-4">
                <p className="text-sm font-semibold">Para onde o estoque está indo</p>
                <p className="text-xs text-muted-foreground">
                  Estoque de amanhã = estoque de hoje + produção média − saídas
                </p>
                <div className="mt-3 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={snap.trajetoria}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="dia" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => formatarNumero(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: 12,
                        }}
                        formatter={(v: number) => formatarNumero(v)}
                        labelFormatter={(l) => (l === 0 ? "Hoje" : `Dia ${l}`)}
                      />
                      <ReferenceLine x={0} stroke="var(--foreground)" label={{ value: "Hoje", fontSize: 11, fill: "var(--foreground)", position: "top" }} />
                      <ReferenceLine y={snap.estoqueMaximo} stroke="var(--destructive)" strokeDasharray="6 4" label={{ value: "Máximo", fontSize: 11, fill: "var(--destructive)", position: "insideTopLeft" }} />
                      <ReferenceLine y={snap.preAlertaSuperior} stroke="var(--chart-3)" strokeDasharray="2 4" label={{ value: "Próximo do máximo", fontSize: 10, fill: "var(--chart-3)", position: "insideBottomRight" }} />
                      <ReferenceLine y={snap.preAlertaInferior} stroke="var(--chart-3)" strokeDasharray="2 4" label={{ value: "Próximo do mínimo", fontSize: 10, fill: "var(--chart-3)", position: "insideTopRight" }} />
                      <ReferenceLine y={snap.estoqueMinimo} stroke="var(--destructive)" strokeDasharray="6 4" label={{ value: "Mínimo", fontSize: 11, fill: "var(--destructive)", position: "insideBottomLeft" }} />
                      <Line type="monotone" dataKey="estoque" name="Estoque projetado" stroke="var(--success)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Ligue o modo automático para acompanhar o estoque a cada nova sincronização, ou clique em
              “Atualizar projeção agora”.
            </div>
          )}
        </div>

        {snap ? (
          <div className="rounded-md border border-border p-4 text-sm">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Recomendação</p>
            <p className="mt-1">{snap.recomendacao}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              O Gêmeo Digital apenas monitora, projeta e recomenda — nenhuma ação é executada no processo real.
              {auto ? " Alertas são enviados por e-mail aos destinatários de Notificações somente quando a situação muda." : ""}
            </p>
            {ultimoEnvio ? <p className="mt-1 text-xs text-muted-foreground">{ultimoEnvio}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="font-semibold tabular-nums">{v}</div>
    </div>
  );
}
