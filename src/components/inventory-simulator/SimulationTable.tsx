import { formatarNumero } from "@/lib/twin-math";
import type { Scenario, SimulationBatch } from "@/lib/inventorySimulation";
import { Badge } from "@/components/ui/badge";

function ResultadoBadge({ resultado }: { resultado: Scenario["resultado"] }) {
  const classe =
    resultado === "FALTA"
      ? "bg-destructive/15 text-destructive border-destructive/40"
      : resultado === "ADEQUADO"
        ? "bg-success/15 text-success border-success/40"
        : "bg-amber-500/15 text-amber-600 border-amber-500/40 dark:text-amber-400";
  return (
    <Badge variant="outline" className={classe}>
      {resultado}
    </Badge>
  );
}

export function SimulationTable({ batch }: { batch: SimulationBatch }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em]">
        {batch.cenarios.length} cenários distintos comparados
      </h3>
      <div className="mt-3 w-full overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
              <th className="py-2 pr-4">Cenário</th>
              <th className="py-2 pr-4">Produção</th>
              <th className="py-2 pr-4">Consumo</th>
              <th className="py-2 pr-4">Estoque no {batch.dia}º dia</th>
              <th className="py-2 pr-4">Primeiro alerta até o {batch.dia}º dia</th>
              <th className="py-2">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {batch.cenarios.map((c) => (
              <tr key={c.id} className="border-b border-border/60">
                <td className="py-2 pr-4 font-mono text-xs">{c.id}</td>
                <td className="py-2 pr-4">
                  {c.producaoRotulo} — {formatarNumero(c.producaoValor)}/dia
                </td>
                <td className="py-2 pr-4">
                  {c.consumoRotulo} — {formatarNumero(c.consumoValor)}/dia
                </td>
                <td className="py-2 pr-4 tabular-nums">{formatarNumero(c.estoqueNoDia)}</td>
                <td className="py-2 pr-4 text-muted-foreground">{c.primeiroAlerta}</td>
                <td className="py-2">
                  <ResultadoBadge resultado={c.resultado} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
