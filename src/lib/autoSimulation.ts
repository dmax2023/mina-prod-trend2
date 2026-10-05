// Simulador Automático: projeção do estoque a partir da dinâmica real de produção.
// Reutiliza a série diária de prepararSerie (mesma fonte do gráfico principal) e o mesmo
// balanço de estoque do simulador manual: E(t+1) = E(t) + P - C.
import type { SeriePonto } from "./twin-math";

export type AutoConfig = {
  workCenter: string;
  horizonte: number;
  estoqueAtual: number;
  estoqueMaximo: number;
  minimoModo: "auto" | "manual";
  estoqueMinimoManual: number;
  consumoAtivo: boolean;
  janelaConsumo: number;
  pctMinimo: number; // % do máximo usado no mínimo automático
  pctPreAlerta: number; // % da faixa segura usada nos avisos de proximidade
  pctProducaoMin: number; // % de P_ref
  pctProducaoMax: number; // % de P_ref
};

export type EstadoEstoque =
  | "ADEQUADO"
  | "PROXIMO_MAXIMO"
  | "PROXIMO_MINIMO"
  | "RISCO_SUPERIOR"
  | "RISCO_INFERIOR";
export type EstadoProducao = "ADEQUADA" | "ABAIXO" | "ACIMA" | "SEM_DADOS";

export type AutoSnapshot = {
  tipo: "auto";
  geradoEm: string;
  workCenter: string;
  horizonte: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  estoqueMaximo: number;
  preAlertaInferior: number;
  preAlertaSuperior: number;
  producaoRef: number;
  producaoMin: number;
  producaoMax: number;
  producaoAtual: number | null;
  ultimoDadoProducao: string | null;
  consumoAtivo: boolean;
  consumoRef: number | null;
  janelaConsumo: number | null;
  saldoLiquido: number;
  trajetoria: { dia: number; estoque: number }[];
  estadoEstoque: EstadoEstoque;
  estadoProducao: EstadoProducao;
  diaEvento: number | null;
  evento: string;
  recomendacao: string;
};

export function estoqueMinimo(c: AutoConfig): number {
  return c.minimoModo === "auto" ? (c.pctMinimo / 100) * c.estoqueMaximo : c.estoqueMinimoManual;
}

export function validarConfig(c: AutoConfig): string | null {
  const min = estoqueMinimo(c);
  if (!(c.estoqueMaximo > 0)) return "Informe o estoque máximo.";
  if (!(min >= 0 && min < c.estoqueMaximo)) return "O estoque mínimo deve ser menor que o máximo.";
  if (!(c.horizonte >= 1)) return "O horizonte deve ser de pelo menos 1 dia.";
  if (!(c.estoqueAtual >= 0)) return "O estoque atual não pode ser negativo.";
  return null;
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);

/** Primeiro dia (1..H) em que a condição é verdadeira; 0 se já for verdadeira hoje. */
function primeiroDia(traj: { dia: number; estoque: number }[], cond: (e: number) => boolean) {
  const p = traj.find((t) => cond(t.estoque));
  return p ? p.dia : null;
}

export function calcularProjecaoAutomatica(serie: SeriePonto[], c: AutoConfig): AutoSnapshot | null {
  // Dias sem produção na série são lacunas preenchidas com zero → não contam como produção válida.
  const validos = serie.filter((p) => Number.isFinite(p.producao) && p.producao > 0);
  if (validos.length === 0 || validarConfig(c)) return null;

  const ultimos7 = validos.slice(-7);
  const producaoRef = ultimos7.reduce((a, p) => a + p.producao, 0) / ultimos7.length;
  const producaoMin = (c.pctProducaoMin / 100) * producaoRef;
  const producaoMax = (c.pctProducaoMax / 100) * producaoRef;
  const ultimo = validos[validos.length - 1]!;
  const producaoAtual = ultimo.producao;

  // A conexão MES ativa não fornece saídas reais de estoque: consumo nunca é inventado.
  const consumoRef: number | null = null;
  const saldoLiquido = producaoRef - (c.consumoAtivo && consumoRef !== null ? consumoRef : 0);

  const eMin = estoqueMinimo(c);
  const eMax = c.estoqueMaximo;
  const faixa = eMax - eMin;
  const preInf = eMin + (c.pctPreAlerta / 100) * faixa;
  const preSup = eMax - (c.pctPreAlerta / 100) * faixa;

  const trajetoria = [{ dia: 0, estoque: c.estoqueAtual }];
  for (let t = 1; t <= c.horizonte; t++) {
    trajetoria.push({ dia: t, estoque: trajetoria[t - 1]!.estoque + saldoLiquido });
  }

  const dMax = primeiroDia(trajetoria, (e) => e > eMax);
  const dMin = primeiroDia(trajetoria, (e) => e < eMin);
  const dPreSup = primeiroDia(trajetoria, (e) => e >= preSup);
  const dPreInf = primeiroDia(trajetoria, (e) => e <= preInf);

  let estadoEstoque: EstadoEstoque = "ADEQUADO";
  let diaEvento: number | null = null;
  let evento = `Sem alerta até o dia ${c.horizonte}`;
  if (dMin !== null && (dMax === null || dMin <= dMax)) {
    estadoEstoque = "RISCO_INFERIOR";
    diaEvento = dMin;
    evento = dMin === 0 ? "Abaixo do estoque mínimo hoje" : `Estoque mínimo em ${dMin} dia(s)`;
  } else if (dMax !== null) {
    estadoEstoque = "RISCO_SUPERIOR";
    diaEvento = dMax;
    evento = dMax === 0 ? "Acima do estoque máximo hoje" : `Estoque máximo em ${dMax} dia(s)`;
  } else if (dPreSup !== null && saldoLiquido >= 0) {
    estadoEstoque = "PROXIMO_MAXIMO";
    diaEvento = dPreSup;
    evento = `Próximo do máximo em ${dPreSup} dia(s)`;
  } else if (dPreInf !== null) {
    estadoEstoque = "PROXIMO_MINIMO";
    diaEvento = dPreInf;
    evento = `Próximo do mínimo em ${dPreInf} dia(s)`;
  }

  const estadoProducao: EstadoProducao =
    producaoAtual < producaoMin ? "ABAIXO" : producaoAtual > producaoMax ? "ACIMA" : "ADEQUADA";

  const recs: string[] = [];
  if (estadoEstoque === "RISCO_SUPERIOR" || estadoEstoque === "PROXIMO_MAXIMO") {
    recs.push(
      `${evento}. Mantido o ritmo de ${fmt(saldoLiquido)} un./dia, avalie reduzir a produção ou aumentar as saídas.`,
    );
  } else if (estadoEstoque === "RISCO_INFERIOR" || estadoEstoque === "PROXIMO_MINIMO") {
    recs.push(
      producaoAtual >= producaoMax
        ? `${evento}. A produção já está no máximo da faixa (${fmt(producaoMax)} un./dia); avalie reduzir as saídas.`
        : `${evento}. Avalie aumentar a produção em direção a ${fmt(producaoMax)} un./dia.`,
    );
  } else {
    recs.push(`Estoque dentro da faixa segura durante os próximos ${c.horizonte} dias.`);
  }
  if (estadoProducao === "ABAIXO") {
    recs.push(
      `A produção atual está ${fmt(((producaoMin - producaoAtual) / producaoMin) * 100)}% abaixo da faixa mínima.`,
    );
  } else if (estadoProducao === "ACIMA") {
    recs.push(`A produção atual está acima da faixa máxima (${fmt(producaoMax)} un./dia).`);
  }

  return {
    tipo: "auto",
    geradoEm: new Date().toISOString(),
    workCenter: c.workCenter,
    horizonte: c.horizonte,
    estoqueAtual: c.estoqueAtual,
    estoqueMinimo: eMin,
    estoqueMaximo: eMax,
    preAlertaInferior: preInf,
    preAlertaSuperior: preSup,
    producaoRef,
    producaoMin,
    producaoMax,
    producaoAtual,
    ultimoDadoProducao: ultimo.date,
    consumoAtivo: c.consumoAtivo,
    consumoRef,
    janelaConsumo: c.consumoAtivo ? c.janelaConsumo : null,
    saldoLiquido,
    trajetoria,
    estadoEstoque,
    estadoProducao,
    diaEvento,
    evento,
    recomendacao: recs.join(" "),
  };
}

export const ROTULO_ESTOQUE: Record<EstadoEstoque, string> = {
  ADEQUADO: "Estoque adequado",
  PROXIMO_MAXIMO: "Próximo do máximo",
  PROXIMO_MINIMO: "Próximo do mínimo",
  RISCO_SUPERIOR: "Risco superior",
  RISCO_INFERIOR: "Risco inferior",
};
export const ROTULO_PRODUCAO: Record<EstadoProducao, string> = {
  ADEQUADA: "Produção adequada",
  ABAIXO: "Produção abaixo da faixa",
  ACIMA: "Produção acima da faixa",
  SEM_DADOS: "Sem dados de produção",
};

/** Chave de deduplicação: Centro + estado do estoque + estado da produção. */
export function chaveAlerta(s: AutoSnapshot): string | null {
  if (s.estadoEstoque === "ADEQUADO" && s.estadoProducao === "ADEQUADA") return null;
  return `${s.workCenter}|${s.estadoEstoque}|${s.estadoProducao}`;
}
