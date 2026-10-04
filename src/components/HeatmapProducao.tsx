import { useMemo, useState } from "react";
import { Flame } from "lucide-react";

import type { ProductionRecord } from "@/lib/mes.functions";
import { DIAS_SEMANA, listarTurnos, montarHeatmap } from "@/lib/twin-math";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function corAtingimento(valor: number | null): string {
  if (valor === null) return "var(--secondary)";
  // 60% -> vermelho, 100% -> verde, 130%+ -> azul
  const v = Math.max(50, Math.min(140, valor));
  const hue = ((v - 50) / 90) * 150; // 0 (vermelho) .. 150 (verde/ciano)
  return `oklch(0.62 0.15 ${hue})`;
}

export function HeatmapProducao({ records }: { records: ProductionRecord[] }) {
  const [turno, setTurno] = useState("todos");
  const turnos = useMemo(() => listarTurnos(records), [records]);
  const linhas = useMemo(() => montarHeatmap(records, turno), [records, turno]);

  return (
    <section className="mx-auto mt-4 max-w-7xl">
      <div className="panel p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]">
              <Flame className="size-4 text-primary" />
              Mapa de Calor da Produção
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Atingimento da meta (%) por dia da semana × centro de trabalho e turno.
            </p>
          </div>
          <div className="w-48 space-y-1">
            <Label className="text-xs">Turno</Label>
            <Select value={turno} onValueChange={setTurno}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os turnos</SelectItem>
                {turnos.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {linhas.length === 0 ? (
          <div className="mt-6 py-10 text-center text-sm text-muted-foreground">
            Sem metas registradas no MES para montar o mapa de calor.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th className="w-64 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Centro · turno
                  </th>
                  {DIAS_SEMANA.map((d) => (
                    <th
                      key={d}
                      className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground"
                    >
                      {d}
                    </th>
                  ))}
                  <th className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Média
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.chave}>
                    <td className="max-w-64 truncate pr-3 text-xs text-foreground">
                      {linha.workCenter}
                      <span className="text-muted-foreground"> · {linha.turno}</span>
                    </td>
                    {linha.celulas.map((c) => (
                      <td key={c.dia} className="p-0">
                        <div
                          title={
                            c.atingimento === null
                              ? "Sem meta registrada"
                              : `${c.produzido.toFixed(0)} de ${c.meta.toFixed(0)} un`
                          }
                          className="flex h-11 items-center justify-center rounded-md text-xs font-semibold tabular-nums text-background"
                          style={{ background: corAtingimento(c.atingimento) }}
                        >
                          {c.atingimento === null ? "—" : c.atingimento.toFixed(0)}
                        </div>
                      </td>
                    ))}
                    <td className="p-0">
                      <div className="flex h-11 items-center justify-center rounded-md border border-border text-xs font-semibold tabular-nums">
                        {linha.media === null ? "—" : `${linha.media.toFixed(0)}%`}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span>50%</span>
              <div
                className="h-2 flex-1 rounded-full"
                style={{
                  background: `linear-gradient(to right, ${corAtingimento(50)}, ${corAtingimento(95)}, ${corAtingimento(140)})`,
                }}
              />
              <span>140%</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
