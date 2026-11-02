import type { AutoSnapshot } from './autoSimulation';
import { recomendarAjuste } from './autoGuidance';
import type { SimulationBatch } from './inventorySimulation';
import type { SimulationResult } from './simulation';

export type EmailPayload = AutoSnapshot | SimulationBatch | SimulationResult;
const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c));
const n = (v: number) => new Intl.NumberFormat('en-US', {maximumFractionDigits: 2}).format(v);
const date = (v: string) => new Date(v).toLocaleString('en-GB', {timeZone: 'UTC'}) + ' UTC';
const center = (v: string) => ['todos','Todos','Todos os centros'].includes(v) ? 'All work centers' : v;
const rows = (items: [string, string | number][]) => `<table style="border-collapse:collapse;width:100%">${items.map(([k,v]) => `<tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">${esc(k)}</th><td style="padding:8px;border-bottom:1px solid #ddd">${esc(v)}</td></tr>`).join('')}</table>`;
const paras = (v: string) => v.split('\n\n').map(t => `<p>${esc(t)}</p>`).join('');
const page = (title: string, body: string) => `<!doctype html><html lang="en"><body style="font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;padding:24px"><h2>${esc(title)}</h2>${body}<p style="color:#777;font-size:12px">The Digital Twin monitors, projects and recommends only. It does not execute changes in the real process.</p></body></html>`;
const stock = {ADEQUADO:'Adequate stock', PROXIMO_MAXIMO:'Near maximum', PROXIMO_MINIMO:'Near minimum', RISCO_SUPERIOR:'Upper stock risk', RISCO_INFERIOR:'Lower stock risk'};
const production = {ADEQUADA:'Adequate production', ABAIXO:'Production below band', ACIMA:'Production above band', SEM_DADOS:'No production data'};
const labels: Record<string,string> = {'Produção reduzida':'Reduced production','Produção típica':'Typical production','Produção elevada':'Elevated production','Sem expedição':'No dispatch','Muito baixo':'Very low','Baixo':'Low','Esperado':'Expected','Alto':'High','Muito alto':'Very high'};
const alert = (v: string) => v.replace(/^Capacidade no dia (\d+)$/, 'Capacity reached on day $1').replace(/^Falta no dia (\d+)$/, 'Shortage on day $1').replace(/^Sem alerta até o dia (\d+)$/, 'No alert through day $1');

export function montarEmailSimulacao(s: EmailPayload): string {
  if ('tipo' in s && s.tipo === 'auto') {
    const event = s.diaEvento === null ? `No alert through day ${s.horizonte}` : `${stock[s.estadoEstoque]} ${s.diaEvento === 0 ? 'today' : `on day ${s.diaEvento}`}`;
    return page('Digital Twin — Automatic inventory projection alert', `<p>Generated: ${esc(date(s.geradoEm))} · Source: MES</p><h3>Analysis</h3>${rows([
      ['Work center',center(s.workCenter)],['Status',`${stock[s.estadoEstoque]}; ${production[s.estadoProducao]}`],
      ['Current stock',`${n(s.estoqueAtual)} units`],['Minimum stock',`${n(s.estoqueMinimo)} units`],['Maximum stock',`${n(s.estoqueMaximo)} units`],
      ['Lower / upper proximity thresholds',`${n(s.preAlertaInferior)} / ${n(s.preAlertaSuperior)} units`],
      ['Historical production reference (last 7 positive observations)',`${n(s.producaoRef)} units/day`],['Configured production band',`${n(s.producaoMin)}–${n(s.producaoMax)} units/day`],
      ['Latest daily production',s.producaoAtual === null ? 'Unavailable' : `${n(s.producaoAtual)} units/day`],['Latest production record',s.ultimoDadoProducao ?? 'Unavailable'],
      ['Withdrawals',s.consumoAtivo ? s.consumoRef === null ? 'Unavailable — no withdrawals modeled' : `${n(s.consumoRef)} units/day` : 'Not included in model'],
      ['Modeled daily net balance',`${n(s.saldoLiquido)} units/day`],['Horizon',`${n(s.horizonte)} days`],['First projected alert',event],
    ])}<h3>Decision support and recommendation</h3>${paras(recomendarAjuste(s,'en'))}`);
  }
  if ('cenarios' in s) {
    const result = {FALTA:'SHORTAGE',ADEQUADO:'ADEQUATE',EXCESSO:'EXCESS'};
    const table = `<table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr>${['Scenario','Production (units/day)','Consumption (units/day)',`Stock on day ${s.dia}`,'First alert','Result'].map(t=>`<th style="text-align:left;padding:8px;border-bottom:2px solid #999">${esc(t)}</th>`).join('')}</tr></thead><tbody>${s.cenarios.map(c=>`<tr>${[c.id,`${labels[c.producaoRotulo] ?? 'Production'} — ${n(c.producaoValor)}`,`${labels[c.consumoRotulo] ?? 'Consumption'} — ${n(c.consumoValor)}`,n(c.estoqueNoDia),alert(c.primeiroAlerta),result[c.resultado]].map(t=>`<td style="padding:8px;border-bottom:1px solid #ddd">${esc(t)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return page('Manual inventory projection scenario simulator', `<p>Generated: ${esc(date(s.geradoEm))}</p><h3>Parameters</h3>${rows([
      ['Work center',center(s.workCenter)],['Stock available today',n(s.estoqueInicial)],['Entered daily consumption',`${n(s.consumoInformado)} units/day`],['Projection day',s.dia],['Maximum capacity',n(s.capacidade)],['Source snapshot received at',date(s.baseAtualizadaEm)],
    ])}<h3>Summary</h3>${rows([
      ['Distinct scenarios',s.resumo.total],['Adequate',s.resumo.adequados],['Shortage risk',s.resumo.falta],['Excess',s.resumo.excesso],['Robust consumption range',s.faixaRobusta ? `${n(s.faixaRobusta.min)}–${n(s.faixaRobusta.max)} units/day` : 'No common range across the three production conditions.'],
    ])}<h3>Projected scenarios</h3>${table}<h3>Technical data</h3>${rows([
      ['Typical production',`${n(s.tecnico.producaoTipica)} units/day`],['Q25 of 7-day moving average',n(s.tecnico.q25)],['Q75 of 7-day moving average',n(s.tecnico.q75)],['Regression slope',s.tecnico.coef.toFixed(2)],['Intercept',s.tecnico.intercepto.toFixed(2)],['R²',s.tecnico.r2.toFixed(4)],
    ])}`);
  }
  // The existing regression snapshot remains unchanged; English wording uses its calculated fields.
  const r = s as SimulationResult;
  const net = r.regression.coef - r.parameters.consumoDiario;
  const inference = [net > 0 ? `Increasing trend: stock grows by ${n(net)} units/day after daily consumption of ${n(r.parameters.consumoDiario)} units.` : net < 0 ? `Decreasing trend: stock falls by ${n(-net)} units/day with daily consumption of ${n(r.parameters.consumoDiario)} units.` : 'Stable trend: production and daily consumption are balanced.', `Model fit (R²): ${r.regression.r2.toFixed(4)} — ${r.regression.r2 >= .9 ? 'strong' : r.regression.r2 >= .6 ? 'moderate' : 'weak'} fit.`];
  const recommendations = [r.forecast.atingiuLimite || (r.forecast.diaLimite !== null && r.forecast.diaLimite <= r.parameters.diaConsulta) ? 'Stock limit exceeded within the analyzed horizon: assess a production-rate reduction or additional storage capacity.' : r.forecast.diaLimite !== null ? `Plan dispatch before day ${r.forecast.diaLimite}, when the stock limit is expected to be reached.` : 'Stock is under control within the analyzed horizon; maintain the current production plan.'];
  if (net < 0) recommendations.push('Consumption exceeds production: plan replenishment to avoid a stockout.');
  if (r.regression.r2 < .6) recommendations.push('Weak model fit: extend the observation window before making decisions based on the forecast.');
  return page('Production and inventory simulation', `<p>Generated: ${esc(date(r.generatedAt))}</p><h3>Parameters</h3>${rows([
    ['Work center',center(r.parameters.workCenter)],['Observed days',r.parameters.dias],['Projection day',r.parameters.diaConsulta],['Maximum stock limit',n(r.parameters.limite)],['Daily stock consumption',n(r.parameters.consumoDiario)],
  ])}<h3>Results</h3>${rows([
    ['MES records',r.indicators.registros],['Accumulated production',n(r.indicators.producaoTotal)],['Current stock',n(r.indicators.estoqueAtual)],['Days in window',r.indicators.diasNaJanela],
  ])}<h3>Trend</h3>${rows([
    ['Equation',`Stock = ${r.regression.coef.toFixed(2)} × Day + ${r.regression.intercepto.toFixed(2)}`],['R²',r.regression.r2.toFixed(4)],['Slope',`${r.regression.coef.toFixed(2)} units/day`],
  ])}<h3>Forecast</h3>${rows([
    [`Projected stock on day ${r.parameters.diaConsulta}`,`${n(r.forecast.previsaoDiaConsulta)} units`],['Stock limit reached',r.forecast.atingiuLimite ? 'Yes' : 'No'],['Expected limit day',r.forecast.diaLimite === null ? 'The trend does not reach the limit' : r.forecast.diaLimite],
  ])}<h3>Inferences</h3>${paras(inference.join('\n\n'))}<h3>Recommendations</h3>${paras(recommendations.join('\n\n'))}`);
}
