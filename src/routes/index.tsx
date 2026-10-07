import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Activity, AlertTriangle, CheckCircle2, Gauge, RefreshCw, Radio } from "lucide-react";

import {
  getActiveConnectionInfo,
  getProductionCount,
  type ProductionRecord,
  type ProductionSnapshot,
} from "@/lib/mes.functions";
import { ConexoesApi } from "@/components/ConexoesApi";
import { SyncMes, type SyncInfo } from "@/components/SyncMes";
import {
  diaQueAtingeLimite,
  formatarNumero,
  listarWorkCenters,
  prepararSerie,
  prever,
  regressaoLinear,
  TODOS_WORK_CENTERS,
} from "@/lib/twin-math";
import { montarSimulacao } from "@/lib/simulation";
import { enviarSimulacao } from "@/lib/notifications.functions";
import { HeatmapProducao } from "@/components/HeatmapProducao";
import { InventorySimulator } from "@/components/inventory-simulator/InventorySimulator";
import { AutoSimulator } from "@/components/AutoSimulator";
import { DestinatariosSimulacao } from "@/components/DestinatariosSimulacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gêmeo Digital MES | Produção em tempo real" },
      {
        name: "description",
        content:
          "Gêmeo digital conectado ao MES: coleta automática a cada 5 segundos, regressão linear e previsão de estoque acumulado por linha de produção.",
      },
      { property: "og:title", content: "Gêmeo Digital MES | Produção em tempo real" },
      {
        property: "og:description",
        content:
          "Monitoramento contínuo da produção com previsão de estoque acumulado por regressão linear.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DigitalTwin,
});

const START_DATE = "2025-01-01T00:00:00Z";
const POLL_MS = 1000;
const DIA_MS = 86_400_000;

const chave = (r: ProductionRecord) =>
  `${r.date}|${r.shift ?? ""}|${r.workCenter ?? ""}|${r.product ?? ""}`;

/** Carga histórica inicial + consulta incremental (último dia) reconciliada sem duplicidades. */
function reconciliar(anteriores: ProductionRecord[], novos: ProductionRecord[], desde: number) {
  const mapa = new Map<string, ProductionRecord>();
  for (const r of anteriores) if (Date.parse(r.date) < desde) mapa.set(chave(r), r);
  for (const r of novos) mapa.set(chave(r), r);
  return [...mapa.values()];
}

function DigitalTwin() {
  const [workCenter, setWorkCenter] = useState("LINHA 1 GARRAFÃO 20L");
  const [dias, setDias] = useState(365);
  const [diaConsulta, setDiaConsulta] = useState(400);
  const [limite, setLimite] = useState(10000);
  const [consumoDiario, setConsumoDiario] = useState(0);

  const qc = useQueryClient();
  const { data: conexao, isFetched: conexaoResolvida } = useQuery({
    queryKey: ["mes-active-connection"],
    queryFn: () => getActiveConnectionInfo(),
    refetchInterval: 15000,
  });
  const connectionId = conexao?.id ?? null;
  const amostras = useRef<number[]>([]);
  const vistos = useRef(new Set<string>());
  const [sync, setSync] = useState<SyncInfo | null>(null);
  useEffect(() => {
    amostras.current = [];
    vistos.current = new Set();
    setSync(null);
  }, [connectionId]);

  const { data, isFetching, dataUpdatedAt, error } = useQuery({
    queryKey: ["production", connectionId],
    enabled: Boolean(connectionId),
    queryFn: async (): Promise<ProductionSnapshot> => {
      const prev = qc.getQueryData<ProductionSnapshot>(["production", connectionId]);
      const temBase = Boolean(prev && !prev.error && prev.records.length);
      const ultimo = temBase
        ? Math.max(...prev!.records.map((r) => Date.parse(r.date)).filter(Number.isFinite))
        : NaN;
      const desde = Number.isFinite(ultimo) ? ultimo - DIA_MS : Date.parse(START_DATE);
      const snap = await getProductionCount({
        data: { connectionId: connectionId!, startDate: new Date(desde).toISOString() },
      });
      if (snap.error === "Conexão MES alterada") {
        void qc.invalidateQueries({ queryKey: ["mes-active-connection"] });
      }
      // D_TR MES → GD somente com timestamp de origem real (nunca inventado).
      // 1 evento novo = 1 amostra; chave = centro + timestamp MES + quantidade.
      const recebido = Date.parse(snap.receivedAt);
      let ultimoEvento: number | null = null;
      let invalidas = 0;
      for (const r of snap.records) {
        const t = r.eventTimestamp ? Date.parse(r.eventTimestamp) : NaN;
        if (!Number.isFinite(t)) continue;
        ultimoEvento = Math.max(ultimoEvento ?? t, t);
        const chave = `${r.workCenter}|${t}|${r.totalQuantity}`;
        if (vistos.current.has(chave)) continue;
        vistos.current.add(chave);
        const dtr = recebido - t;
        if (dtr < 0) invalidas++;
        else amostras.current = [...amostras.current, dtr].slice(-1000);
      }
      setSync({
        requestedAt: snap.requestedAt,
        receivedAt: snap.receivedAt,
        eventTimestamp: ultimoEvento !== null ? new Date(ultimoEvento).toISOString() : null,
        amostras: amostras.current,
        erro: snap.error,
        apiMs: Date.parse(snap.receivedAt) - Date.parse(snap.requestedAt),
        relogio: invalidas > 0,
      });
      if (snap.error || !temBase) return snap;
      return { ...snap, records: reconciliar(prev!.records, snap.records, desde) };
    },
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const records = useMemo(
    () => (data && !data.error && data.connectionId === connectionId ? data.records : []),
    [data, connectionId],
  );
  const workCenters = useMemo(() => listarWorkCenters(records), [records]);
  const serie = useMemo(
    () => prepararSerie(records, workCenter, dias),
    [records, workCenter, dias],
  );
  const reg = useMemo(() => regressaoLinear(serie), [serie]);

  const previsaoConsulta = prever(reg, diaConsulta) - consumoDiario * diaConsulta;
  const atingiu = previsaoConsulta >= limite;
  const diaLimite = diaQueAtingeLimite({ ...reg, coef: reg.coef - consumoDiario }, limite);
  const producaoTotal = serie.reduce((a, p) => a + p.producao, 0);
  const estoqueAtual = serie.length ? (serie[serie.length - 1]?.estoque ?? 0) : 0;

  const chartData = useMemo(() => {
    const ultimoDia = Math.max(diaConsulta + 20, serie.length + 60);
    const pontos: {
      dia: number;
      estoque?: number | undefined;
      producaoDia?: number | null;
      suavizado?: number | undefined;
      previsao: number;
    }[] = [];
    for (let d = 1; d <= ultimoDia; d++) {
      const p = serie[d - 1];
      pontos.push({
        dia: d,
        estoque: p?.estoque,
        producaoDia: p && p.producao > 0 ? p.estoque : null,
        suavizado: p?.estoqueSuavizado,
        previsao: prever(reg, d) - consumoDiario * d,
      });
    }
    return pontos;
  }, [serie, reg, diaConsulta, consumoDiario]);

  const semConexao = conexaoResolvida && !connectionId;
  const mesOffline = semConexao || Boolean(error) || Boolean(data?.error);
  const mensagemMes = semConexao ? "Conexão MES não configurada" : "Falha na conexão MES";

  // Centro selecionado inexistente na nova fonte → "Todos".
  useEffect(() => {
    if (
      workCenters.length &&
      workCenter !== TODOS_WORK_CENTERS &&
      !workCenters.includes(workCenter)
    ) {
      setWorkCenter(TODOS_WORK_CENTERS);
    }
  }, [workCenters, workCenter]);

  const [enviando, setEnviando] = useState(false);
  const enviarFn = useServerFn(enviarSimulacao);

  async function handleEnviar() {
    if (serie.length < 2) {
      toast.error("Não há simulação válida para enviar.");
      return;
    }
    setEnviando(true);
    try {
      const simulation = montarSimulacao({
        workCenter,
        dias,
        diaConsulta,
        limite,
        consumoDiario,
        serie,
        reg,
        registros: records.length,
      });
      const res = await enviarFn({ data: { simulation } });
      if (res.ok) {
        toast.success("Simulação enviada com sucesso.");
      } else if (res.motivo === "sem-destinatarios") {
        toast.error("Nenhum destinatário habilitado.");
      } else {
        toast.error(res.mensagem ?? "Falha ao enviar a simulação.");
      }
    } catch {
      toast.error("Falha ao enviar a simulação.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <header className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-primary">Digital Twin</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            Gêmeo Digital · Produção MES
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Sincronização automática a cada 1 segundo com a conexão MES ativa.
            Os dados alimentam o modelo de regressão linear e a previsão de estoque acumulado.
          </p>
        </div>
        <div className="flex items-center gap-3">
        <LanguageSwitch />
        <div className="panel glow flex items-center gap-3 px-4 py-3">
          <span
            className={`live-dot inline-block size-2.5 rounded-full ${
              mesOffline ? "bg-destructive" : "bg-success"
            }`}
          />
          <div className="text-xs leading-tight">
            <div className="font-semibold uppercase tracking-widest">
              {mesOffline ? mensagemMes : "Streaming 1s"}
            </div>
            <div className="text-muted-foreground">
              Último sync:{" "}
              {dataUpdatedAt
                ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR")
                : "aguardando..."}
            </div>
          </div>
          <RefreshCw
            className={`size-4 text-primary ${isFetching ? "animate-spin" : "opacity-40"}`}
          />
        </div>
      </header>

      <SyncMes conexao={conexao?.name ?? null} info={sync} semConexao={semConexao} />

      <section className="mx-auto mt-6 grid max-w-7xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<Radio className="size-4" />}
          label="Registros do MES"
          value={formatarNumero(records.length)}
          hint={`${workCenters.length} centros de trabalho`}
        />
        <Kpi
          icon={<Activity className="size-4" />}
          label="Produção acumulada"
          value={formatarNumero(producaoTotal)}
          hint={`${serie.length} dias na janela`}
        />
        <Kpi
          icon={<Gauge className="size-4" />}
          label="Estoque atual"
          value={formatarNumero(estoqueAtual)}
          hint={`Tendência ${reg.coef.toFixed(2)} un/dia`}
        />
        <Kpi
          icon={
            atingiu ? (
              <AlertTriangle className="size-4 text-destructive" />
            ) : (
              <CheckCircle2 className="size-4 text-success" />
            )
          }
          label={`Previsão dia ${diaConsulta}`}
          value={formatarNumero(previsaoConsulta)}
          hint={atingiu ? "Limite ultrapassado" : "Dentro do limite"}
        />
      </section>

      <HeatmapProducao records={records} />

      <section className="mx-auto mt-4 grid max-w-7xl gap-4 lg:grid-cols-[320px_1fr]">
        <div className="panel space-y-6 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Parâmetros do gêmeo
          </h2>

          <div className="space-y-2">
            <Label>Centro de trabalho</Label>
            <Select value={workCenter} onValueChange={setWorkCenter}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_WORK_CENTERS}>Todos</SelectItem>
                {(workCenters.length ? workCenters : [workCenter]).map((wc) => (
                  <SelectItem key={wc} value={wc}>
                    {wc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dias">Dias observados</Label>
            <Input
              id="dias"
              type="number"
              min={2}
              value={dias}
              onChange={(e) => setDias(Math.max(2, Number(e.target.value) || 2))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="consulta">Dia que deseja verificar</Label>
            <Input
              id="consulta"
              type="number"
              min={1}
              value={diaConsulta}
              onChange={(e) => setDiaConsulta(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="consumo">Consumo de estoque diário</Label>
            <Input
              id="consumo"
              type="number"
              min={0}
              value={consumoDiario}
              onChange={(e) => setConsumoDiario(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>

          <div className="space-y-3">
            <Label>Limite máximo de estoque: {formatarNumero(limite)}</Label>
            <Slider
              value={[limite]}
              min={1000}
              max={1000000}
              step={1000}
              onValueChange={(v) => setLimite(v[0] ?? limite)}
            />
          </div>

          <div className="rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Modelo</p>
            <p className="mt-1">
              Estoque = {reg.coef.toFixed(2)} × Dia + {reg.intercepto.toFixed(2)}
            </p>
            <p className="mt-1">R² = {reg.r2.toFixed(4)}</p>
            <p className="mt-1">
              {diaLimite
                ? `Limite atingido no dia ${diaLimite}`
                : "Tendência não atinge o limite"}
            </p>
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em]">
              Projeção do estoque líquido acumulado baseada no balanço entre produção e consumo
            </h2>
            <span className="text-xs text-muted-foreground">{workCenter}</span>
          </div>

          <div className="mt-4 h-[420px]">
            {serie.length < 2 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {mesOffline
                  ? (semConexao ? mensagemMes : (data?.error ?? mensagemMes))
                  : "Sincronizando dados do MES..."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="dia"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 11 }}
                    type="number"
                    domain={[1, "dataMax"]}
                  />
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
                    labelFormatter={(l) => `Dia ${l}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="estoque"
                    name="Estoque acumulado"
                    stroke="var(--chart-5)"
                    dot={false}
                    strokeWidth={1}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="suavizado"
                    name="Média móvel 7d"
                    stroke="var(--chart-2)"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="previsao"
                    name="Regressão linear"
                    stroke="var(--chart-1)"
                    dot={false}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    isAnimationActive={false}
                  />
                  <Scatter
                    dataKey="producaoDia"
                    name="Dias com produção"
                    fill="var(--chart-3)"
                  />
                  <ReferenceLine
                    y={limite}
                    stroke="var(--destructive)"
                    strokeDasharray="5 5"
                    label={{
                      value: `Limite ${formatarNumero(limite)}`,
                      fill: "var(--destructive)",
                      fontSize: 11,
                      position: "insideTopRight",
                    }}
                  />
                  <ReferenceLine
                    x={diaConsulta}
                    stroke="var(--chart-3)"
                    strokeDasharray="2 4"
                    label={{
                      value: `Dia ${diaConsulta}`,
                      fill: "var(--chart-3)",
                      fontSize: 11,
                      position: "top",
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div
            className={`mt-4 rounded-md border p-4 text-sm ${
              atingiu
                ? "border-destructive/50 bg-destructive/10"
                : "border-success/40 bg-success/10"
            }`}
          >
            No dia <strong>{diaConsulta}</strong> o estoque previsto é de{" "}
            <strong>{formatarNumero(previsaoConsulta)}</strong> unidades —{" "}
            {atingiu
              ? `o limite de ${formatarNumero(limite)} já foi atingido.`
              : `o limite de ${formatarNumero(limite)} ainda não foi atingido.`}
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={() => void handleEnviar()} disabled={enviando || serie.length < 2}>
              {enviando ? "Enviando..." : "Enviar simulação"}
            </Button>
          </div>
        </div>
      </section>

      <InventorySimulator
        key={connectionId ?? "sem-conexao"}
        records={records}
        workCenters={workCenters}
        workCenterAtual={workCenter}
        dias={dias}
        dataAtualizadaEm={dataUpdatedAt}
      />

      <AutoSimulator
        key={`auto-${connectionId ?? "sem-conexao"}`}
        records={records}
        workCenters={workCenters}
        workCenterAtual={workCenter}
      />

      <DestinatariosSimulacao />

      <ConexoesApi />
    </main>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
