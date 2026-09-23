import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatarNumero } from "@/lib/twin-math";
import type { SimulationBatch } from "@/lib/inventorySimulation";

export function SimulationChart({ batch }: { batch: SimulationBatch }) {
  const data = batch.envelope.map((p) => ({
    dia: p.dia,
    faixa: [p.inferior, p.superior] as [number, number],
    menor: p.inferior,
    maior: p.superior,
    esperado: p.esperado,
  }));

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em]">
        Simulação de Estoque baseada em Regressão Linear da Produção
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        A regressão estima a produção típica; as linhas mostram os saldos de estoque projetados.
      </p>

      <div className="mt-4 h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="dia"
              type="number"
              domain={[0, batch.dia]}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 11 }}
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
              formatter={(v: number | number[]) =>
                Array.isArray(v)
                  ? `${formatarNumero(v[0] ?? 0)} — ${formatarNumero(v[1] ?? 0)}`
                  : formatarNumero(v)
              }
              labelFormatter={(l) => `Dia ${l}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              dataKey="faixa"
              name="Faixa dos cenários"
              stroke="none"
              fill="var(--muted-foreground)"
              fillOpacity={0.15}
              isAnimationActive={false}
            />
            <Line
              dataKey="menor"
              name="Menor estoque projetado"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="maior"
              name="Maior estoque projetado"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="esperado"
              name="Saldo esperado — produção típica estimada pela regressão"
              stroke="#16a34a"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceLine
              y={batch.capacidade}
              stroke="#dc2626"
              strokeDasharray="6 4"
              label={{
                value: `Capacidade máxima ${formatarNumero(batch.capacidade)}`,
                fill: "#dc2626",
                fontSize: 11,
                position: "insideTopRight",
              }}
            />
            <ReferenceLine
              y={0}
              stroke="currentColor"
              className="text-foreground"
              strokeDasharray="2 3"
              label={{
                value: "Estoque zero",
                fill: "var(--foreground)",
                fontSize: 11,
                position: "insideBottomRight",
              }}
            />
            <ReferenceLine
              x={batch.dia}
              stroke="var(--chart-3)"
              strokeDasharray="4 2"
              label={{
                value: `Previsão no ${batch.dia}º dia`,
                fill: "var(--chart-3)",
                fontSize: 11,
                position: "top",
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
