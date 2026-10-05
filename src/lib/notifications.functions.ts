import { createServerFn } from "@tanstack/react-start";
import type { SimulationResult } from "./simulation";
import type { SimulationBatch } from "./inventorySimulation";
import { ROTULO_ESTOQUE, ROTULO_PRODUCAO, type AutoSnapshot } from "./autoSimulation";

type Payload = SimulationResult | SimulationBatch | AutoSnapshot;

function isAuto(s: Payload): s is AutoSnapshot {
  return (s as AutoSnapshot).tipo === "auto";
}

function montarHtmlAuto(s: AutoSnapshot): string {
  const row = (k: string, v: string) =>
    `<tr><th style="text-align:left;padding:6px 12px 6px 0;color:#555;font-weight:normal">${k}</th><td style="padding:6px 0"><b>${v}</b></td></tr>`;
  const centro = s.workCenter === "todos" ? "Todos os centros" : s.workCenter;
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111;background:#ffffff;padding:24px">
  <h2 style="margin:0 0 4px">GÊMEO DIGITAL</h2>
  <p style="margin:0 0 16px">Alerta do <b>Simulador Automático</b> — ${new Date(s.geradoEm).toLocaleString("pt-BR")} — Fonte: MES</p>
  <h3>Análise</h3>
  <table style="border-collapse:collapse;font-size:14px">
    ${row("Centro de trabalho", centro)}
    ${row("Status", `${ROTULO_ESTOQUE[s.estadoEstoque]}; ${ROTULO_PRODUCAO[s.estadoProducao]}`)}
    ${row("Estoque atual", `${fmt(s.estoqueAtual)} un.`)}
    ${row("Estoque mínimo", `${fmt(s.estoqueMinimo)} un.`)}
    ${row("Estoque máximo", `${fmt(s.estoqueMaximo)} un.`)}
    ${row("Produção média 7 dias", `${fmt(s.producaoRef)} un./dia`)}
    ${row("Faixa de produção", `${fmt(s.producaoMin)} – ${fmt(s.producaoMax)} un./dia`)}
    ${row("Produção atual", s.producaoAtual === null ? "—" : `${fmt(s.producaoAtual)} un./dia`)}
    ${row("Consumo", s.consumoAtivo ? (s.consumoRef === null ? "Dados insuficientes" : `${fmt(s.consumoRef)} un./dia`) : "Desabilitado")}
    ${row("Saldo líquido", `${fmt(s.saldoLiquido)} un./dia`)}
    ${row("Horizonte", `${fmt(s.horizonte)} dias`)}
    ${row("Evento previsto", s.evento)}
  </table>
  <h3>Recomendação</h3>
  <p>${s.recomendacao}</p>
  <p style="color:#777;font-size:12px">O Gêmeo Digital apenas monitora, projeta e recomenda — nenhuma ação é executada no processo real.</p>
</body></html>`;
}

type EnvioResultado = {
  ok: boolean;
  enviados: number;
  falhas: number;
  motivo?: "sem-destinatarios" | "erro";
  mensagem?: string;
};

function fmt(v: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
}

function montarHtml(s: SimulationResult): string {
  const li = (itens: string[]) =>
    itens.length ? `<ul>${itens.map((i) => `<li>${i}</li>`).join("")}</ul>` : "<p>—</p>";

  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111;background:#ffffff;padding:24px">
  <h2 style="margin:0 0 4px">Simulação de Produção e Estoque</h2>
  <p style="color:#555;margin:0 0 16px">Data/hora: ${new Date(s.generatedAt).toLocaleString("pt-BR")}</p>

  <h3>Parâmetros utilizados</h3>
  <ul>
    <li>Centro de trabalho: ${s.parameters.workCenter}</li>
    <li>Dias observados: ${fmt(s.parameters.dias)}</li>
    <li>Dia verificado: ${fmt(s.parameters.diaConsulta)}</li>
    <li>Limite máximo de estoque: ${fmt(s.parameters.limite)}</li>
    <li>Consumo de estoque diário: ${fmt(s.parameters.consumoDiario)}</li>
  </ul>

  <h3>Resultados</h3>
  <ul>
    <li>Registros do MES: ${fmt(s.indicators.registros)}</li>
    <li>Produção acumulada: ${fmt(s.indicators.producaoTotal)}</li>
    <li>Estoque atual: ${fmt(s.indicators.estoqueAtual)}</li>
    <li>Dias na janela: ${fmt(s.indicators.diasNaJanela)}</li>
  </ul>

  <h3>Tendência</h3>
  <ul>
    <li>Equação: ${s.regression.equacao}</li>
    <li>R²: ${s.regression.r2.toFixed(4)}</li>
    <li>Inclinação: ${s.regression.coef.toFixed(2)} un/dia</li>
  </ul>

  <h3>Previsão</h3>
  <ul>
    <li>Estoque previsto no dia ${fmt(s.parameters.diaConsulta)}: ${fmt(s.forecast.previsaoDiaConsulta)} unidades</li>
    <li>Limite atingido: ${s.forecast.atingiuLimite ? "sim" : "não"}</li>
    <li>${s.forecast.diaLimite ? `Dia previsto para atingir o limite: ${s.forecast.diaLimite}` : "A tendência não atinge o limite"}</li>
  </ul>

  <h3>Inferências</h3>
  ${li(s.inferences)}

  <h3>Recomendações</h3>
  ${li(s.recommendations)}
</body></html>`;
}

function isSimulationBatch(s: Payload): s is SimulationBatch {
  return "cenarios" in s && Array.isArray(s.cenarios);
}

function montarHtmlCenarios(s: SimulationBatch): string {
  const faixa = s.faixaRobusta
    ? `${fmt(s.faixaRobusta.min)} a ${fmt(s.faixaRobusta.max)} un/dia`
    : "Não existe uma faixa comum às três condições de produção.";
  const linhas = s.cenarios
    .map(
      (c) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">${c.id}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${c.producaoRotulo} — ${fmt(c.producaoValor)}/dia</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${c.consumoRotulo} — ${fmt(c.consumoValor)}/dia</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${fmt(c.estoqueNoDia)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${c.primeiroAlerta}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd"><strong>${c.resultado}</strong></td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111;background:#ffffff;padding:24px">
  <h2 style="margin:0 0 4px">Simulação Automática de Cenários de Estoque</h2>
  <p style="color:#555;margin:0 0 16px">Data/hora: ${new Date(s.geradoEm).toLocaleString("pt-BR")}</p>

  <h3>Parâmetros utilizados</h3>
  <ul>
    <li>Centro de trabalho: ${s.workCenter}</li>
    <li>Estoque disponível hoje: ${fmt(s.estoqueInicial)}</li>
    <li>Consumo informado: ${fmt(s.consumoInformado)} unidades/dia</li>
    <li>Dia previsto: ${fmt(s.dia)}</li>
    <li>Capacidade máxima: ${fmt(s.capacidade)}</li>
    <li>Última base analisada: ${new Date(s.baseAtualizadaEm).toLocaleString("pt-BR")}</li>
  </ul>

  <h3>Resumo</h3>
  <ul>
    <li>Cenários distintos: ${fmt(s.resumo.total)}</li>
    <li>Adequados: ${fmt(s.resumo.adequados)}</li>
    <li>Risco de falta: ${fmt(s.resumo.falta)}</li>
    <li>Excesso: ${fmt(s.resumo.excesso)}</li>
    <li>Faixa de consumo robusta: ${faixa}</li>
  </ul>

  <h3>Cenários projetados</h3>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <thead><tr>
      <th style="padding:8px;text-align:left;border-bottom:2px solid #999">Cenário</th>
      <th style="padding:8px;text-align:left;border-bottom:2px solid #999">Produção</th>
      <th style="padding:8px;text-align:left;border-bottom:2px solid #999">Consumo</th>
      <th style="padding:8px;text-align:left;border-bottom:2px solid #999">Estoque no ${s.dia}º dia</th>
      <th style="padding:8px;text-align:left;border-bottom:2px solid #999">Primeiro alerta</th>
      <th style="padding:8px;text-align:left;border-bottom:2px solid #999">Resultado</th>
    </tr></thead>
    <tbody>${linhas}</tbody>
  </table>

  <h3>Dados técnicos</h3>
  <ul>
    <li>Produção típica: ${fmt(s.tecnico.producaoTipica)} unidades/dia</li>
    <li>Q25 da média móvel de 7 dias: ${fmt(s.tecnico.q25)}</li>
    <li>Q75 da média móvel de 7 dias: ${fmt(s.tecnico.q75)}</li>
    <li>Coeficiente da regressão: ${s.tecnico.coef.toFixed(2)}</li>
    <li>Intercepto: ${s.tecnico.intercepto.toFixed(2)}</li>
    <li>R²: ${s.tecnico.r2.toFixed(4)}</li>
  </ul>
  </body></html>`;
}

export const enviarSimulacao = createServerFn({ method: "POST" })
  .inputValidator((input: { simulation: Payload }) => input)
  .handler(async ({ data }): Promise<EnvioResultado> => {
    const simulation = data.simulation;
    const valida = simulation && (isAuto(simulation)
      ? simulation.trajetoria.length > 0 && Number.isFinite(simulation.producaoRef)
      : isSimulationBatch(simulation)
      ? simulation.cenarios.length > 0 && Number.isFinite(simulation.dia)
      : Number.isFinite(simulation.forecast?.previsaoDiaConsulta));
    if (!valida) {
      return { ok: false, enviados: 0, falhas: 0, motivo: "erro", mensagem: "Simulação inválida." };
    }

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const resendKey = process.env["RESEND_API_KEY"];
    if (!lovableKey || !resendKey) {
      return { ok: false, enviados: 0, falhas: 0, motivo: "erro", mensagem: "Serviço de e-mail não configurado." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: recipients, error } = await supabaseAdmin
      .from("notification_recipients")
      .select("name, email")
      .eq("enabled", true);

    if (error) {
      console.error("Falha ao buscar destinatários", error);
      return { ok: false, enviados: 0, falhas: 0, motivo: "erro", mensagem: "Falha ao buscar destinatários." };
    }
    if (!recipients || recipients.length === 0) {
      return { ok: false, enviados: 0, falhas: 0, motivo: "sem-destinatarios" };
    }

    const from =
      process.env["RESEND_FROM_EMAIL"] ??
      "Digital Twin <simulacoes@forecastingdigitaltwin.com.br>";
    const html = isAuto(simulation)
      ? montarHtmlAuto(simulation)
      : isSimulationBatch(simulation)
        ? montarHtmlCenarios(simulation)
        : montarHtml(simulation);
    const subject = isAuto(simulation)
      ? `[GD] Alerta de projeção de estoque — ${simulation.workCenter === "todos" ? "Todos os centros" : simulation.workCenter}`
      : "Resultado da Simulação — Digital Twin";

    let enviados = 0;
    let falhas = 0;
    let ultimaFalha: string | null = null;

    for (const r of recipients) {
      let status = "sent";
      let errorMessage: string | null = null;
      try {
        const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": resendKey,
          },
          body: JSON.stringify({ from, to: [r.email], subject, html }),
        });
        if (!res.ok) {
          const body = await res.text();
          console.error(`Resend falhou [${res.status}]: ${body}`);
          status = "failed";
          let detalhe = "";
          try {
            detalhe = String((JSON.parse(body) as { message?: unknown }).message ?? "");
          } catch {
            detalhe = "";
          }
          errorMessage = detalhe ? `${res.status}: ${detalhe}`.slice(0, 300) : `${res.status}`;
          ultimaFalha =
            res.status === 403
              ? "O remetente de teste do Resend só entrega para o e-mail dono da conta. Verifique um domínio no Resend para enviar aos demais destinatários."
              : "Falha no serviço de e-mail ao enviar a simulação.";
          falhas++;
        } else {
          enviados++;
        }
      } catch (e) {
        console.error("Erro de envio", e);
        status = "failed";
        errorMessage = "network";
        ultimaFalha = "Falha de rede ao contatar o serviço de e-mail.";
        falhas++;
      }

      await supabaseAdmin.from("notification_logs").insert({
        simulation_ref: isAuto(simulation) || isSimulationBatch(simulation) ? simulation.geradoEm : simulation.generatedAt,
        recipient: r.email,
        status,
        error_message: errorMessage,
      });
    }

    if (enviados === 0) {
      return {
        ok: false,
        enviados,
        falhas,
        motivo: "erro",
        mensagem: ultimaFalha ?? "Não foi possível enviar os e-mails.",
      };
    }
    return { ok: true, enviados, falhas };
  });
