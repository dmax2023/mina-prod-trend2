import { useState } from "react";

import type { ProductionRecord } from "@/lib/mes.functions";
import { TODOS_WORK_CENTERS } from "@/lib/twin-math";
import { buildScenarios, type SimulationBatch } from "@/lib/inventorySimulation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SimulationSummary } from "./SimulationSummary";
import { SimulationChart } from "./SimulationChart";
import { SimulationTable } from "./SimulationTable";
import { SimulationMethodology } from "./SimulationMethodology";

const MAX_VALOR = 9_999_999_999;

function numero(valor: string, minimo = 0): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return minimo;
  return Math.min(MAX_VALOR, Math.max(minimo, n));
}

export function InventorySimulator({
  records,
  workCenters,
  workCenterAtual,
  dias,
  dataAtualizadaEm,
}: {
  records: ProductionRecord[];
  workCenters: string[];
  workCenterAtual: string;
  dias: number;
  dataAtualizadaEm: number | undefined;
}) {
  const [workCenter, setWorkCenter] = useState(workCenterAtual);
  const [simulationDay, setSimulationDay] = useState(30);
  const [estoqueInicial, setEstoqueInicial] = useState(0);
  const [consumo, setConsumo] = useState(0);
  const [capacidade, setCapacidade] = useState(100000);
  const [batch, setBatch] = useState<SimulationBatch | null>(null);

  function simular() {
    setBatch(
      buildScenarios({
        records,
        dias,
        workCenter,
        dia: simulationDay,
        estoqueInicial,
        consumoDiario: consumo,
        capacidade,
        baseAtualizadaEm: new Date(dataAtualizadaEm ?? Date.now()).toISOString(),
      }),
    );
  }

  return (
    <section className="mx-auto mt-4 max-w-7xl">
      <div className="panel space-y-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em]">
            Simulação Automática de Cenários de Estoque
          </h2>
          {dataAtualizadaEm ? (
            <span className="text-xs text-muted-foreground">
              Dados atualizados às {new Date(dataAtualizadaEm).toLocaleTimeString("pt-BR")}
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label>Centro de trabalho</Label>
            <Select value={workCenter} onValueChange={setWorkCenter}>
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
            <Label htmlFor="sim-dia">Prever estoque no dia</Label>
            <Input
              id="sim-dia"
              type="number"
              min={1}
              value={simulationDay}
              onChange={(e) => setSimulationDay(Math.round(numero(e.target.value, 1)) || 1)}
            />
            <p className="text-xs text-muted-foreground">
              Ex.: 30 = calcular quanto estoque haverá exatamente no 30º dia.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sim-estoque">Estoque disponível hoje</Label>
            <Input
              id="sim-estoque"
              type="number"
              min={0}
              max={MAX_VALOR}
              value={estoqueInicial}
              onChange={(e) => setEstoqueInicial(numero(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sim-consumo">Quanto costuma sair do estoque por dia</Label>
            <Input
              id="sim-consumo"
              type="number"
              min={0}
              max={MAX_VALOR}
              value={consumo}
              onChange={(e) => setConsumo(numero(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sim-capacidade">Capacidade máxima do estoque</Label>
            <Input
              id="sim-capacidade"
              type="number"
              min={0}
              max={MAX_VALOR}
              value={capacidade}
              onChange={(e) => setCapacidade(numero(e.target.value))}
            />
          </div>

          <div className="flex items-end">
            <Button className="w-full" onClick={simular} disabled={records.length === 0}>
              Simular cenários
            </Button>
          </div>
        </div>

        {batch ? (
          <div className="space-y-6">
            <SimulationSummary batch={batch} />
            <SimulationChart batch={batch} />
            <SimulationTable batch={batch} />
            <SimulationMethodology batch={batch} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Informe os valores acima e clique em “Simular cenários” para comparar os resultados.
          </p>
        )}
      </div>
    </section>
  );
}
