import { createServerFn } from "@tanstack/react-start";
import type { SimulationResult } from "./simulation";
import type { SimulationBatch } from "./inventorySimulation";
import type { AutoSnapshot } from "./autoSimulation";
import { montarEmailSimulacao } from "./simulationEmail";

type Payload = SimulationResult | SimulationBatch | AutoSnapshot;

function isAuto(s: Payload): s is AutoSnapshot {
  return (s as AutoSnapshot).tipo === "auto";
}

type EnvioResultado = {
  ok: boolean;
  enviados: number;
  falhas: number;
  motivo?: "sem-destinatarios" | "erro";
  mensagem?: string;
};
function isSimulationBatch(s: Payload): s is SimulationBatch {
  return "cenarios" in s && Array.isArray(s.cenarios);
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
    const html = montarEmailSimulacao(simulation);
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
