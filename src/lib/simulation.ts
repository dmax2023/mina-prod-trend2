import { diaQueAtingeLimite, formatarNumero, prever, type Regressao, type SeriePonto } from "./twin-math";

export type SimulationResult = {
  generatedAt: string;
  parameters: {
    workCenter: string;
    dias: number;
    diaConsulta: number;
    limite: number;
    consumoDiario: number;
  };
  regression: {
    coef: number;
    intercepto: number;
    r2: number;
    equacao: string;
  };
  indicators: {
    registros: number;
    producaoTotal: number;
    estoqueAtual: number;
    diasNaJanela: number;
  };
  forecast: {
    previsaoDiaConsulta: number;
    atingiuLimite: boolean;
    diaLimite: number | null;
  };
  inferences: string[];
  recommendations: string[];
};

export function montarSimulacao(params: {
  workCenter: string;
  dias: number;
  diaConsulta: number;
  limite: number;
  consumoDiario: number;
  serie: SeriePonto[];
  reg: Regressao;
  registros: number;
}): SimulationResult {
  const { workCenter, dias, diaConsulta, limite, consumoDiario, serie, reg, registros } = params;

  const coefLiquido = reg.coef - consumoDiario;
  const previsaoDiaConsulta = prever(reg, diaConsulta) - consumoDiario * diaConsulta;
  const atingiuLimite = previsaoDiaConsulta >= limite;
  const diaLimite = diaQueAtingeLimite({ ...reg, coef: coefLiquido }, limite);
  const producaoTotal = serie.reduce((a, p) => a + p.producao, 0);
  const estoqueAtual = serie.length ? (serie[serie.length - 1]?.estoque ?? 0) : 0;

  const inferences: string[] = [];
  const recommendations: string[] = [];

  if (coefLiquido > 0) {
    inferences.push(
      `Tendência crescente: o estoque cresce ${formatarNumero(coefLiquido)} unidades por dia já descontado o consumo diário de ${formatarNumero(consumoDiario)}.`,
    );
  } else if (coefLiquido < 0) {
    inferences.push(
      `Tendência decrescente: o estoque cai ${formatarNumero(Math.abs(coefLiquido))} unidades por dia com o consumo diário de ${formatarNumero(consumoDiario)}.`,
    );
  } else {
    inferences.push("Tendência estável: produção e consumo diário estão equilibrados.");
  }

  inferences.push(
    `Qualidade do ajuste (R²) de ${reg.r2.toFixed(4)} — ${
      reg.r2 >= 0.9 ? "ajuste forte" : reg.r2 >= 0.6 ? "ajuste moderado" : "ajuste fraco"
    }.`,
  );
  inferences.push(
    `No dia ${diaConsulta} o estoque projetado é de ${formatarNumero(previsaoDiaConsulta)} unidades frente ao limite de ${formatarNumero(limite)}.`,
  );
  if (diaLimite) {
    inferences.push(`Pelo modelo atual, o limite de estoque é atingido no dia ${diaLimite}.`);
  } else if (coefLiquido <= 0) {
    inferences.push("Com o consumo informado, a tendência não atinge o limite de estoque.");
  }

  if (atingiuLimite || (diaLimite !== null && diaLimite <= diaConsulta)) {
    recommendations.push("Limite de estoque ultrapassado no horizonte analisado: avaliar redução de ritmo ou ampliação da capacidade de armazenagem.");
  } else if (diaLimite) {
    recommendations.push(`Planejar escoamento antes do dia ${diaLimite}, quando o limite tende a ser atingido.`);
  } else {
    recommendations.push("Nível de estoque sob controle no horizonte analisado; manter o plano de produção atual.");
  }

  if (coefLiquido < 0) {
    recommendations.push("Consumo supera a produção: programar reposição para evitar ruptura de estoque.");
  }
  if (reg.r2 < 0.6) {
    recommendations.push("Baixa aderência do modelo: ampliar a janela de dias observados antes de decidir com base na previsão.");
  }

  return {
    generatedAt: new Date().toISOString(),
    parameters: { workCenter, dias, diaConsulta, limite, consumoDiario },
    regression: {
      coef: reg.coef,
      intercepto: reg.intercepto,
      r2: reg.r2,
      equacao: `Estoque = ${reg.coef.toFixed(2)} × Dia + ${reg.intercepto.toFixed(2)}`,
    },
    indicators: {
      registros,
      producaoTotal,
      estoqueAtual,
      diasNaJanela: serie.length,
    },
    forecast: { previsaoDiaConsulta, atingiuLimite, diaLimite },
    inferences,
    recommendations,
  };
}
