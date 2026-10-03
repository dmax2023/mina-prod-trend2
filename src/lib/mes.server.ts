// Única fonte de configuração MES: a conexão marcada como ativa em mes_connections.
// Nenhuma URL ou token MES pode existir fora daqui.

export type ActiveMesConnection = {
  id: string;
  name: string;
  baseUrl: string;
  token: string;
  endpoints: string[];
  lastSyncAt: string | null;
};

export async function getActiveMesConnection(): Promise<ActiveMesConnection | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("mes_connections")
    .select("id, name, base_url, token, endpoints, last_sync_at")
    .eq("active", true)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    baseUrl: data.base_url,
    token: data.token,
    endpoints: data.endpoints ?? [],
    lastSyncAt: data.last_sync_at,
  };
}

export type MesEndpointKind = "ProductionCount" | "Scrap" | "Rework" | "ProductionOee" | "ProductionState";

const MATCHERS: Record<MesEndpointKind, (e: string) => boolean> = {
  ProductionCount: (e) => /\/ProductionCount\/\{startDate\}/i.test(e),
  Scrap: (e) => /\/Scrap\//i.test(e),
  Rework: (e) => /\/Rework\//i.test(e),
  ProductionOee: (e) => /\/ProductionOee\//i.test(e),
  ProductionState: (e) => /\/ProductionState\//i.test(e),
};

export function resolveEndpoint(
  conn: { baseUrl: string; endpoints: string[] },
  kind: MesEndpointKind,
  startDate: string,
  endDate: string,
): string | null {
  const ep = conn.endpoints.find(MATCHERS[kind]);
  if (!ep) return null;
  const path = ep
    .replace("{startDate}", encodeURIComponent(startDate))
    .replace("{endDate}", encodeURIComponent(endDate));
  return `${conn.baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export async function fetchMes(
  conn: ActiveMesConnection,
  kind: MesEndpointKind,
  startDate: string,
  endDate: string,
): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  const url = resolveEndpoint(conn, kind, startDate, endDate);
  if (!url) return { ok: false, error: `Endpoint ${kind} não cadastrado na conexão ativa` };
  try {
    const res = await fetch(url, { headers: { ApiKey: conn.token, accept: "application/json" } });
    if (!res.ok) return { ok: false, error: `Falha na conexão MES (${res.status})` };
    return { ok: true, json: await res.json() };
  } catch {
    return { ok: false, error: "Falha na conexão MES" };
  }
}
