import type { ProductionRecord } from "./mes.functions";

export type SeriePonto = {
  dia: number;
  date: string;
  producao: number;
  estoque: number;
  estoqueSuavizado: number;
};

export type Regressao = {
  coef: number;
  intercepto: number;
  r2: number;
};

const DIA_MS = 86_400_000;

export function listarWorkCenters(records: ProductionRecord[]): string[] {
  return Array.from(
    new Set(records.map((r) => r.workCenter).filter((w): w is string => Boolean(w))),
  ).sort();
}

export function prepararSerie(
  records: ProductionRecord[],
  workCenter: string,
  qtdDias: number,
): SeriePonto[] {
  const filtrados = records.filter(
    (r) => r.workCenter === workCenter && r.date && Number.isFinite(Number(r.totalQuantity)),
  );
  if (filtrados.length === 0) return [];

  const porDia = new Map<string, number>();
  for (const r of filtrados) {
    const key = r.date.slice(0, 10);
    porDia.set(key, (porDia.get(key) ?? 0) + Number(r.totalQuantity ?? 0));
  }

  const chaves = Array.from(porDia.keys()).sort();
  const inicio = Date.parse(`${chaves[0]}T00:00:00Z`);
  const fim = Date.parse(`${chaves[chaves.length - 1]}T00:00:00Z`);

  const completos: { date: string; producao: number }[] = [];
  for (let t = inicio; t <= fim; t += DIA_MS) {
    const key = new Date(t).toISOString().slice(0, 10);
    completos.push({ date: key, producao: porDia.get(key) ?? 0 });
  }

  const recorte = completos.slice(Math.max(0, completos.length - qtdDias));

  let acumulado = 0;
  const serie: SeriePonto[] = recorte.map((p, i) => {
    acumulado += p.producao;
    return {
      dia: i + 1,
      date: p.date,
      producao: p.producao,
      estoque: acumulado,
      estoqueSuavizado: 0,
    };
  });

  // média móvel 7 dias sobre o estoque acumulado
  for (let i = 0; i < serie.length; i++) {
    const janela = serie.slice(Math.max(0, i - 6), i + 1);
    serie[i].estoqueSuavizado =
      janela.reduce((acc, p) => acc + p.estoque, 0) / janela.length;
  }

  return serie;
}

export function regressaoLinear(serie: SeriePonto[]): Regressao {
  const n = serie.length;
  if (n < 2) return { coef: 0, intercepto: 0, r2: 0 };

  const mediaX = serie.reduce((a, p) => a + p.dia, 0) / n;
  const mediaY = serie.reduce((a, p) => a + p.estoqueSuavizado, 0) / n;

  let num = 0;
  let den = 0;
  for (const p of serie) {
    num += (p.dia - mediaX) * (p.estoqueSuavizado - mediaY);
    den += (p.dia - mediaX) ** 2;
  }

  const coef = den === 0 ? 0 : num / den;
  const intercepto = mediaY - coef * mediaX;

  let ssRes = 0;
  let ssTot = 0;
  for (const p of serie) {
    const pred = coef * p.dia + intercepto;
    ssRes += (p.estoqueSuavizado - pred) ** 2;
    ssTot += (p.estoqueSuavizado - mediaY) ** 2;
  }

  return { coef, intercepto, r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot };
}

export function prever(reg: Regressao, dia: number): number {
  return reg.coef * dia + reg.intercepto;
}

export function diaQueAtingeLimite(reg: Regressao, limite: number): number | null {
  if (reg.coef <= 0) return null;
  return Math.ceil((limite - reg.intercepto) / reg.coef);
}

export function formatarNumero(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(valor);
}
