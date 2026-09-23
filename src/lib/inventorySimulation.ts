import type { ProductionRecord } from "./mes.functions";
import {
  prepararSerie,
  regressaoLinear,
  TODOS_WORK_CENTERS,
  type Regressao,
  type SeriePonto,
} from "./twin-math";

export type ProductionLevel = {
  chave: "reduzida" | "tipica" | "elevada";
  rotulo: string;
  valor: number;
};

export type ConsumptionLevel = {
  chave: string;
  rotulo: string;
  valor: number;
};

export type Scenario = {
  id: string;
  producaoRotulo: string;
  producaoValor: number;
  consumoRotulo: string;
  consumoValor: number;
  estoqueNoDia: number;
  primeiroAlerta: string;
  resultado: "FALTA" | "ADEQUADO" | "EXCESSO";
};

export type Faixa = { min: number; max: number } | null;

export type SimulationBatch = {
  geradoEm: string;
  baseAtualizadaEm: string;
  workCenter: string;
  dia: number;
  estoqueInicial: number;
  consumoInformado: number;
  capacidade: number;
  producoes: ProductionLevel[];
  consumos: ConsumptionLevel[];
  cenarios: Scenario[];
  envelope: {
    dia: number;
    inferior: number;
    superior: number;
    esperado: number;
  }[];
  faixaRobusta: Faixa;
  resumo: {
    adequados: number;
    falta: number;
    excesso: number;
    total: number;
  };
  tecnico: {
    q25: number;
    q75: number;
    producaoTipica: number;
    coef: number;
    intercepto: number;
    r2: number;
    pontosSerie: number;
  };
};

export function calculateMovingAverage7(valores: number[]): number[] {
  return valores.map((_, i) => {
    const janela = valores.slice(Math.max(0, i - 6), i + 1);
    return janela.reduce((a, v) => a + v, 0) / janela.length;
  });
}

export function quantile(valores: number[], q: number): number {
  if (valores.length === 0) return 0;
  const ordenado = [...valores].sort((a, b) => a - b);
  const pos = (ordenado.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  const atual = ordenado[base] ?? 0;
  const proximo = ordenado[base + 1] ?? atual;
  return atual + (proximo - atual) * resto;
}

export function buildProductionLevels(serie: SeriePonto[], reg: Regressao): ProductionLevel[] {
  const q7 = calculateMovingAverage7(serie.map((p) => p.producao));
  const q25 = quantile(q7, 0.25);
  const q75 = quantile(q7, 0.75);
  const tipica = Math.max(reg.coef, 0);
  const reduzida = Math.max(0, Math.min(q25, tipica));
  const elevada = Math.max(tipica, q75);
  return [
    { chave: "reduzida", rotulo: "Produção reduzida", valor: reduzida },
    { chave: "tipica", rotulo: "Produção típica", valor: tipica },
    { chave: "elevada", rotulo: "Produção elevada", valor: elevada },
  ];
}

export function buildConsumptionLevels(consumo: number): ConsumptionLevel[] {
  if (consumo <= 0) {
    return [{ chave: "zero", rotulo: "Sem expedição", valor: 0 }];
  }
  return [
    { chave: "muito-baixo", rotulo: "Muito baixo", valor: consumo * 0.8 },
    { chave: "baixo", rotulo: "Baixo", valor: consumo * 0.9 },
    { chave: "esperado", rotulo: "Esperado", valor: consumo },
    { chave: "alto", rotulo: "Alto", valor: consumo * 1.1 },
    { chave: "muito-alto", rotulo: "Muito alto", valor: consumo * 1.2 },
  ];
}

export function calculateFirstAlert(params: {
  producao: number;
  consumo: number;
  estoqueInicial: number;
  capacidade: number;
  dia: number;
}): string {
  const { producao, consumo, estoqueInicial, capacidade, dia } = params;
  if (producao > consumo) {
    const d = Math.ceil((capacidade - estoqueInicial) / (producao - consumo));
    if (d >= 0 && d <= dia) return `Capacidade no dia ${Math.max(d, 0)}`;
  } else if (consumo > producao) {
    const d = Math.ceil(estoqueInicial / (consumo - producao));
    if (d >= 0 && d <= dia) return `Falta no dia ${Math.max(d, 0)}`;
  }
  return `Sem alerta até o dia ${dia}`;
}

export function calculateScenario(params: {
  id: string;
  producao: ProductionLevel;
  consumo: ConsumptionLevel;
  estoqueInicial: number;
  capacidade: number;
  dia: number;
}): Scenario {
  const { id, producao, consumo, estoqueInicial, capacidade, dia } = params;
  const estoqueNoDia = estoqueInicial + (producao.valor - consumo.valor) * dia;
  const resultado: Scenario["resultado"] =
    estoqueNoDia < 0 ? "FALTA" : estoqueNoDia > capacidade ? "EXCESSO" : "ADEQUADO";
  return {
    id,
    producaoRotulo: producao.rotulo,
    producaoValor: producao.valor,
    consumoRotulo: consumo.rotulo,
    consumoValor: consumo.valor,
    estoqueNoDia,
    primeiroAlerta: calculateFirstAlert({
      producao: producao.valor,
      consumo: consumo.valor,
      estoqueInicial,
      capacidade,
      dia,
    }),
    resultado,
  };
}

export function removeDuplicateScenarios(cenarios: Scenario[]): Scenario[] {
  const vistos = new Set<string>();
  const saida: Scenario[] = [];
  for (const c of cenarios) {
    const chave = `${c.producaoValor.toFixed(4)}|${c.consumoValor.toFixed(4)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push({ ...c, id: `C${String(saida.length + 1).padStart(2, "0")}` });
  }
  return saida;
}

export function calculateOperationalConsumptionRange(params: {
  producao: number;
  estoqueInicial: number;
  capacidade: number;
  dia: number;
}): { min: number; max: number } {
  const { producao, estoqueInicial, capacidade, dia } = params;
  return {
    min: producao + (estoqueInicial - capacidade) / dia,
    max: producao + estoqueInicial / dia,
  };
}

export function calculateRobustConsumptionRange(
  producoes: ProductionLevel[],
  estoqueInicial: number,
  capacidade: number,
  dia: number,
): Faixa {
  let min = -Infinity;
  let max = Infinity;
  for (const p of producoes) {
    const faixa = calculateOperationalConsumptionRange({
      producao: p.valor,
      estoqueInicial,
      capacidade,
      dia,
    });
    min = Math.max(min, faixa.min);
    max = Math.min(max, faixa.max);
  }
  const minFinal = Math.max(min, 0);
  if (minFinal > max) return null;
  return { min: minFinal, max };
}

export function buildScenarioEnvelope(params: {
  cenarios: Scenario[];
  estoqueInicial: number;
  dia: number;
  producaoTipica: number;
  consumoEsperado: number;
}) {
  const { cenarios, estoqueInicial, dia, producaoTipica, consumoEsperado } = params;
  const passos = Math.max(1, Math.min(dia, 120));
  const pontos: SimulationBatch["envelope"] = [];
  for (let i = 0; i <= passos; i++) {
    const t = Math.round((dia * i) / passos);
    const valores = cenarios.map((c) => estoqueInicial + (c.producaoValor - c.consumoValor) * t);
    pontos.push({
      dia: t,
      inferior: valores.length ? Math.min(...valores) : estoqueInicial,
      superior: valores.length ? Math.max(...valores) : estoqueInicial,
      esperado: estoqueInicial + (producaoTipica - consumoEsperado) * t,
    });
  }
  return pontos;
}

export function buildScenarios(params: {
  records: ProductionRecord[];
  dias: number;
  workCenter: string;
  dia: number;
  estoqueInicial: number;
  consumoDiario: number;
  capacidade: number;
  baseAtualizadaEm: string;
}): SimulationBatch {
  const {
    records,
    dias,
    workCenter,
    dia,
    estoqueInicial,
    consumoDiario,
    capacidade,
    baseAtualizadaEm,
  } = params;

  const serie = prepararSerie(records, workCenter, dias);
  const reg = regressaoLinear(serie);
  const producoes = buildProductionLevels(serie, reg);
  const consumos = buildConsumptionLevels(consumoDiario);

  const brutos: Scenario[] = [];
  let i = 0;
  for (const p of producoes) {
    for (const c of consumos) {
      i += 1;
      brutos.push(
        calculateScenario({
          id: `C${String(i).padStart(2, "0")}`,
          producao: p,
          consumo: c,
          estoqueInicial,
          capacidade,
          dia,
        }),
      );
    }
  }
  const cenarios = removeDuplicateScenarios(brutos);

  const q7 = calculateMovingAverage7(serie.map((p) => p.producao));

  return {
    geradoEm: new Date().toISOString(),
    baseAtualizadaEm,
    workCenter: workCenter === TODOS_WORK_CENTERS ? "Todos" : workCenter,
    dia,
    estoqueInicial,
    consumoInformado: consumoDiario,
    capacidade,
    producoes,
    consumos,
    cenarios,
    envelope: buildScenarioEnvelope({
      cenarios,
      estoqueInicial,
      dia,
      producaoTipica: producoes[1]?.valor ?? 0,
      consumoEsperado: consumoDiario,
    }),
    faixaRobusta: calculateRobustConsumptionRange(producoes, estoqueInicial, capacidade, dia),
    resumo: {
      total: cenarios.length,
      adequados: cenarios.filter((c) => c.resultado === "ADEQUADO").length,
      falta: cenarios.filter((c) => c.resultado === "FALTA").length,
      excesso: cenarios.filter((c) => c.resultado === "EXCESSO").length,
    },
    tecnico: {
      q25: quantile(q7, 0.25),
      q75: quantile(q7, 0.75),
      producaoTipica: producoes[1]?.valor ?? 0,
      coef: reg.coef,
      intercepto: reg.intercepto,
      r2: reg.r2,
      pontosSerie: serie.length,
    },
  };
}
