import { describe, expect, test } from 'bun:test';
import { analisarAjuste } from './autoGuidance';
import { calcularProjecaoAutomatica } from './autoSimulation';

const base = { horizonte: 30, estoqueAtual: 50000, estoqueMinimo: 20000, estoqueMaximo: 100000,
  preAlertaInferior: 36000, preAlertaSuperior: 84000, producaoRef: 10000, producaoMin: 2000,
  producaoMax: 10000, producaoAtual: 10000, consumoRef: null, consumoAtivo: false };

describe('Quantitative advisory targets do not execute adjustments', () => {
  test('upper risk: quantify reduction and time to capacity with production-only assumptions', () => {
    const a = analisarAjuste(base);
    expect(a.target).toBeCloseTo(1133.3333333333);
    expect(a.delta).toBeCloseTo(-8866.6666666667);
    expect(a.percent).toBeCloseTo(-88.6666666667);
    expect(a.daysToMax).toBe(5);
    expect(a.targetStock).toBe(84000);
    expect(a.consumptionKnown).toBe(false);
  });
  test('below minimum can recover naturally but still exceed maximum later', () => {
    const a = analisarAjuste({...base, estoqueAtual: 2000});
    expect(a.recoveryDays).toBe(1.8);
    expect(a.daysToMax).toBe(9.8);
    expect(a.delta).toBeLessThan(0);
  });
  test('lower risk: quantify increase needed for end-of-horizon buffer', () => {
    const a = analisarAjuste({...base, estoqueAtual: 0, producaoRef: 500});
    expect(a.target).toBe(1200);
    expect(a.delta).toBe(700);
    expect(a.percent).toBe(140);
    expect(a.targetStock).toBe(36000);
    expect(a.recoveryDays).toBe(40);
  });
  test('already above capacity: no negative production target or claimed feasibility', () => {
    const a = analisarAjuste({...base, estoqueAtual: 120000});
    expect(a.feasible).toBe(false);
    expect(a.target).toBe(0);
    expect(a.excessNow).toBe(20000);
    expect(a.removalForBuffer).toBe(36000);
    expect(a.daysToMax).toBe(0);
  });
  test('unavailable consumption is not inferred when its switch is enabled', () => {
    const a = analisarAjuste({...base, consumoAtivo: true});
    expect(a.consumptionKnown).toBe(false);
    expect(a.consumption).toBe(0);
    expect(a.net).toBe(10000);
  });
  test('stable in-buffer stock retains rate', () => {
    const a = analisarAjuste({...base, producaoRef: 500});
    expect(a.target).toBe(500);
    expect(a.delta).toBe(0);
    expect(a.finalStock).toBe(65000);
  });
  test('existing projection and first-risk priority stay unchanged', () => {
    const series = Array.from({length: 7}, (_,i) => ({dia: i+1, date: `2026-10-${10+i}`, producao: 10000, acumulado: (i+1)*10000, estoque: (i+1)*10000, media7:10000}));
    const s = calcularProjecaoAutomatica(series, {workCenter:'test', horizonte:30, estoqueAtual:2000, estoqueMaximo:100000, minimoModo:'auto', estoqueMinimoManual:20000, consumoAtivo:false, janelaConsumo:30, pctMinimo:20, pctPreAlerta:20, pctProducaoMin:20, pctProducaoMax:100});
    expect(s?.producaoRef).toBe(10000);
    expect(s?.consumoRef).toBe(null);
    expect(s?.trajetoria[30]?.estoque).toBe(302000);
    expect(s?.estadoEstoque).toBe('RISCO_INFERIOR');
    expect(s?.diaEvento).toBe(0);
  });
});