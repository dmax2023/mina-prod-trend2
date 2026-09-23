import { formatarNumero } from "@/lib/twin-math";
import type { SimulationBatch } from "@/lib/inventorySimulation";

export function SimulationSummary({ batch }: { batch: SimulationBatch }) {
  const itens: { label: string; value: string }[] = [
    { label: "Centro analisado", value: batch.workCenter },
    { label: "Previsão", value: `Estoque no ${batch.dia}º dia` },
    { label: "Cenários", value: String(batch.resumo.total) },
    { label: "Adequados", value: String(batch.resumo.adequados) },
    { label: "Risco de falta", value: String(batch.resumo.falta) },
    { label: "Excesso", value: String(batch.resumo.excesso) },
    {
      label: "Faixa de consumo robusta",
      value: batch.faixaRobusta
        ? `${formatarNumero(batch.faixaRobusta.min)} a ${formatarNumero(batch.faixaRobusta.max)} un/dia`
        : "Não existe uma faixa comum às três condições de produção.",
    },
    {
      label: "Última base analisada",
      value: new Date(batch.baseAtualizadaEm).toLocaleString("pt-BR"),
    },
  ];

  return (
    <div className="rounded-md border border-border bg-secondary/40 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        Resumo da simulação
      </h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {itens.map((i) => (
          <div key={i.label}>
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">{i.label}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums">{i.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
