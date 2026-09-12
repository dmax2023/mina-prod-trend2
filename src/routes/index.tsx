import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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

import { getProductionCount } from "@/lib/mes.functions";
import {
  diaQueAtingeLimite,
  formatarNumero,
  listarWorkCenters,
  prepararSerie,
  prever,
  regressaoLinear,
} from "@/lib/twin-math";
import { HeatmapProducao } from "@/components/HeatmapProducao";
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
const END_DATE = "2025-12-31T23:59:59Z";
const POLL_MS = 5000;

function DigitalTwin() {
  const [workCenter, setWorkCenter] = useState("LINHA 1 GARRAFÃO 20L");
  const [dias, setDias] = useState(365);
  const [diaConsulta, setDiaConsulta] = useState(400);
  const [limite, setLimite] = useState(10000);
  const [consumoDiario, setConsumoDiario] = useState(0);

  const { data, isFetching, dataUpdatedAt, error } = useQuery({
    queryKey: ["production", START_DATE, END_DATE],
    queryFn: () => getProductionCount({ data: { startDate: START_DATE, endDate: END_DATE } }),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const records = data?.records ?? [];
  const workCenters = useMemo(() => listarWorkCenters(records), [records]);
  const serie = useMemo(
    () => prepararSerie(records, workCenter, dias),
    [records, workCenter, dias],
  );
  const reg = useMemo(() => regressaoLinear(serie), [serie]);

  const previsaoConsulta = prever(reg, diaConsulta) - consumoDiario * diaConsulta;
  const atingiu = previsaoConsulta >= limite;
  const diaLimite = diaQueAtingeLimite(reg, limite);
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
  }, [serie, reg, diaConsulta]);

  const mesOffline = Boolean(error) || Boolean(data?.error);

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <header className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-primary">Digital Twin</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            Gêmeo Digital · Produção MES
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Sincronização automática com o endpoint /v1/ProductionCount a cada 5 segundos.
            Os dados alimentam o modelo de regressão linear e a previsão de estoque acumulado.
          </p>
        </div>
        <div className="panel glow flex items-center gap-3 px-4 py-3">
          <span
            className={`live-dot inline-block size-2.5 rounded-full ${
              mesOffline ? "bg-destructive" : "bg-success"
            }`}
          />
          <div className="text-xs leading-tight">
            <div className="font-semibold uppercase tracking-widest">
              {mesOffline ? "MES offline" : "Streaming 5s"}
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
              Estoque acumulado e regressão
            </h2>
            <span className="text-xs text-muted-foreground">{workCenter}</span>
          </div>

          <div className="mt-4 h-[420px]">
            {serie.length < 2 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {mesOffline
                  ? (data?.error ?? "Falha ao consultar o MES")
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
        </div>
      </section>

      <HeatmapProducao records={records} />
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
