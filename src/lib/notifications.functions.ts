import { createServerFn } from "@tanstack/react-start";
import type { SimulationResult } from "./simulation";

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

export const enviarSimulacao = createServerFn({ method: "POST" })
  .inputValidator((input: { simulation: SimulationResult }) => input)
  .handler(async ({ data }): Promise<EnvioResultado> => {
    const simulation = data.simulation;
    if (!simulation || !Number.isFinite(simulation.forecast?.previsaoDiaConsulta)) {
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

    const from = process.env["RESEND_FROM_EMAIL"] ?? "Digital Twin <onboarding@resend.dev>";
    const html = montarHtml(simulation);
    const subject = "Resultado da Simulação — Digital Twin";

    let enviados = 0;
    let falhas = 0;

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
          errorMessage = `${res.status}`;
          falhas++;
        } else {
          enviados++;
        }
      } catch (e) {
        console.error("Erro de envio", e);
        status = "failed";
        errorMessage = "network";
        falhas++;
      }

      await supabaseAdmin.from("notification_logs").insert({
        simulation_ref: simulation.generatedAt,
        recipient: r.email,
        status,
        error_message: errorMessage,
      });
    }

    if (enviados === 0) {
      return { ok: false, enviados, falhas, motivo: "erro", mensagem: "Não foi possível enviar os e-mails." };
    }
    return { ok: true, enviados, falhas };
  });
