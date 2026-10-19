import type { AutoSnapshot } from './autoSimulation';
type Input = Pick<AutoSnapshot, 'horizonte' | 'estoqueAtual' | 'estoqueMinimo' | 'estoqueMaximo' | 'preAlertaInferior' | 'preAlertaSuperior' | 'producaoRef' | 'producaoMin' | 'producaoMax' | 'producaoAtual' | 'consumoRef' | 'consumoAtivo'>;

/** Planning estimates only; does not modify projections or alert decisions. */
export function analisarAjuste(s: Input) {
  const consumptionKnown = s.consumoAtivo && s.consumoRef !== null;
  const consumption = consumptionKnown ? s.consumoRef ?? 0 : 0;
  const net = s.producaoRef - consumption;
  const buffered = s.preAlertaInferior <= s.preAlertaSuperior;
  const low = buffered ? s.preAlertaInferior : s.estoqueMinimo;
  const high = buffered ? s.preAlertaSuperior : s.estoqueMaximo;
  const productionMin = Math.max(0, consumption + (low - s.estoqueAtual) / s.horizonte);
  const productionMax = consumption + (high - s.estoqueAtual) / s.horizonte;
  const feasible = productionMax >= productionMin;
  const target = feasible ? Math.min(Math.max(s.producaoRef, productionMin), productionMax) : 0;
  const delta = target - s.producaoRef;
  return { consumptionKnown, consumption, net, low, high, productionMin, productionMax, feasible, target, delta,
    percent: s.producaoRef > 0 ? delta / s.producaoRef * 100 : 0,
    finalStock: s.estoqueAtual + net * s.horizonte,
    targetStock: s.estoqueAtual + (target - consumption) * s.horizonte,
    excessNow: Math.max(0, s.estoqueAtual - s.estoqueMaximo),
    removalForBuffer: Math.max(0, s.estoqueAtual - high),
    daysToMax: s.estoqueAtual > s.estoqueMaximo ? 0 : net > 0 ? (s.estoqueMaximo - s.estoqueAtual) / net : null,
    daysToMin: s.estoqueAtual < s.estoqueMinimo ? 0 : net < 0 ? (s.estoqueAtual - s.estoqueMinimo) / -net : null,
    recoveryDays: s.estoqueAtual < s.estoqueMinimo && net > 0 ? (s.estoqueMinimo - s.estoqueAtual) / net : null,
  };
}

export function recomendarAjuste(s: Input, lang: 'pt' | 'en' = 'pt'): string {
  const a = analisarAjuste(s);
  const en = lang === 'en';
  const n = (v: number) => new Intl.NumberFormat(en ? 'en-US' : 'pt-BR', { maximumFractionDigits: 2 }).format(v);
  const lines = [en
    ? `Basis: historical reference ${n(s.producaoRef)} units/day. Projected stock after ${n(s.horizonte)} days: ${n(a.finalStock)} units, against limits ${n(s.estoqueMinimo)}–${n(s.estoqueMaximo)}.`
    : `Base: referência histórica de ${n(s.producaoRef)} un./dia. Estoque projetado em ${n(s.horizonte)} dias: ${n(a.finalStock)} un., frente aos limites de ${n(s.estoqueMinimo)}–${n(s.estoqueMaximo)}.`];
  if (a.daysToMin === 0) lines.push(en ? 'Stock is already below minimum: review replenishment now.' : 'O estoque já está abaixo do mínimo: avalie reposição agora.');
  if (a.recoveryDays !== null) lines.push(en
    ? `Recovery to minimum takes approximately ${n(a.recoveryDays)} days at the modeled net rate. Increasing production is not automatically justified: also check the upper-limit risk.`
    : `A recuperação até o mínimo leva aproximadamente ${n(a.recoveryDays)} dias ao saldo modelado. Aumentar a produção não é automaticamente justificável: confira também o risco superior.`);
  if (a.daysToMax !== null) lines.push(a.daysToMax === 0
    ? en ? `Maximum already exceeded by ${n(a.excessNow)} units; review action now.` : `O máximo já foi excedido em ${n(a.excessNow)} un.; avalie ação agora.`
    : en ? `Maximum reached in approximately ${n(a.daysToMax)} days if the rate persists. Review the adjustment now and implement before that point if approved.` : `O máximo é alcançado em aproximadamente ${n(a.daysToMax)} dias se o ritmo persistir. Avalie o ajuste agora e implemente antes desse ponto, se aprovado.`);
  if (a.daysToMin !== null && a.daysToMin > 0) lines.push(en ? `Minimum reached in approximately ${n(a.daysToMin)} days; act before that point if approved.` : `O mínimo é alcançado em aproximadamente ${n(a.daysToMin)} dias; atue antes desse ponto, se aprovado.`);
  if (!a.feasible) lines.push(en
    ? `Production adjustment alone cannot reach the buffered range: even zero production is insufficient. Removing at least ${n(a.removalForBuffer)} units now would reach the upper buffer, followed by production balanced with verified withdrawals. Verify dispatch or storage alternatives; this is a required quantity, not confirmed dispatch capacity.`
    : `Ajustar somente a produção não permite atingir a faixa de proteção: mesmo produção zero é insuficiente. Retirar pelo menos ${n(a.removalForBuffer)} un. agora permitiria alcançar o aviso superior, seguido de produção equilibrada com saídas verificadas. Confirme alternativas de expedição ou armazenagem; essa quantidade é uma necessidade calculada, não capacidade de expedição confirmada.`);
  else lines.push(en
    ? `Conditional constant-rate plan, starting now for ${n(s.horizonte)} days: ${a.delta < 0 ? 'reduce' : a.delta > 0 ? 'increase' : 'maintain'} production to ${n(a.target)} units/day (${a.delta >= 0 ? '+' : ''}${n(a.delta)} units/day; ${n(a.percent)}% versus the historical reference). Modeled final stock: ${n(a.targetStock)} units. Production range reaching the end-of-horizon buffer ${n(a.low)}–${n(a.high)}: ${n(a.productionMin)}–${n(a.productionMax)} units/day. This does not guarantee safe stock throughout the interval when stock is already outside limits.`
    : `Plano condicional de ritmo constante, iniciado agora por ${n(s.horizonte)} dias: ${a.delta < 0 ? 'reduzir' : a.delta > 0 ? 'aumentar' : 'manter'} a produção para ${n(a.target)} un./dia (${a.delta >= 0 ? '+' : ''}${n(a.delta)} un./dia; ${n(a.percent)}% frente à referência histórica). Estoque final modelado: ${n(a.targetStock)} un. Faixa de produção que alcança a proteção ${n(a.low)}–${n(a.high)} no fim do horizonte: ${n(a.productionMin)}–${n(a.productionMax)} un./dia. Isso não garante estoque seguro em todo o intervalo se ele já estiver fora dos limites.`);
  if (a.feasible && (a.target < s.producaoMin || a.target > s.producaoMax)) lines.push(en
    ? `Target outside the configured historical production band (${n(s.producaoMin)}–${n(s.producaoMax)} units/day). This band is not verified machine capacity; confirm feasibility before changing the process.`
    : `Meta fora da faixa histórica configurada (${n(s.producaoMin)}–${n(s.producaoMax)} un./dia). Essa faixa não é capacidade comprovada da máquina; confirme a viabilidade antes de alterar o processo.`);
  if (s.producaoAtual !== null) lines.push(en
    ? `Latest daily production: ${n(s.producaoAtual)} units/day. Reference uses the last seven positive-production observations, not necessarily seven consecutive calendar days; the daily record may still be incomplete.`
    : `Última produção diária: ${n(s.producaoAtual)} un./dia. A referência usa as últimas sete observações com produção positiva, não necessariamente sete dias corridos consecutivos; o registro diário pode ainda estar incompleto.`);
  lines.push(a.consumptionKnown
    ? en ? `Assumes verified withdrawals remain at ${n(a.consumption)} units/day.` : `Pressupõe saídas verificadas constantes de ${n(a.consumption)} un./dia.`
    : en ? 'MES does not provide verified withdrawals: these are production-only estimates with no withdrawals modeled, not proof of zero actual consumption. Validate actual stock, dispatch and demand before adopting the target.' : 'O MES não fornece saídas verificadas: estas são estimativas apenas de produção, sem saídas modeladas, e não prova de consumo real zero. Valide estoque real, expedição e demanda antes de adotar a meta.');
  lines.push(en ? 'After an approved change, reassess at the next complete daily record. Shift schedules, machine capacity, downtime and customer demand are unavailable: no hourly ramp, optimal schedule or guaranteed outcome can be inferred. The Digital Twin does not execute changes.' : 'Após um ajuste aprovado, reavalie no próximo registro diário completo. Escalas de turno, capacidade da máquina, paradas e demanda dos clientes não estão disponíveis: não é possível inferir rampa horária, programação ótima ou resultado garantido. O Gêmeo Digital não executa alterações.');
  return lines.join('\n\n');
}
