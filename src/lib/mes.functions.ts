import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ProductionRecord = {
  date: string;
  shift: string | null;
  workCenter: string | null;
  product: string | null;
  productDescription: string | null;
  uomCode: string | null;
  goodQuantity: number | null;
  totalQuantity: number | null;
  targetQuantity: number | null;
  eventTimestamp?: string | null;
};

export type ProductionSnapshot = {
  fetchedAt: string;
  records: ProductionRecord[];
  error: string | null;
  connectionId: string | null;
  requestedAt: string;
  receivedAt: string;
};

export type ActiveConnectionInfo = { id: string; name: string } | null;

/** Metadados públicos da conexão ativa (sem token). */
export const getActiveConnectionInfo = createServerFn({ method: "GET" }).handler(
  async (): Promise<ActiveConnectionInfo> => {
    const { getActiveMesConnection } = await import("./mes.server");
    const c = await getActiveMesConnection();
    return c ? { id: c.id, name: c.name } : null;
  },
);

const rangeSchema = z.object({
  connectionId: z.string().uuid(),
  startDate: z.string().min(1),
});

export const getProductionCount = createServerFn({ method: "GET" })
  .inputValidator((input: { connectionId: string; startDate: string }) => rangeSchema.parse(input))
  .handler(async ({ data }): Promise<ProductionSnapshot> => {
    const requestedAt = new Date().toISOString();
    const { getActiveMesConnection, fetchMes } = await import("./mes.server");
    const conn = await getActiveMesConnection();
    const base = { connectionId: conn?.id ?? null, requestedAt };
    const done = (records: ProductionRecord[], error: string | null): ProductionSnapshot => {
      const receivedAt = new Date().toISOString();
      return { ...base, fetchedAt: receivedAt, receivedAt, records, error };
    };
    if (!conn) return done([], "Conexão MES não configurada");
    if (conn.id !== data.connectionId) return done([], "Conexão MES alterada");

    const endDate = new Date().toISOString();
    const r = await fetchMes(conn, "ProductionCount", data.startDate, endDate);
    if (!r.ok) return done([], r.error);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    void supabaseAdmin.from("mes_connections").update({ last_sync_at: endDate }).eq("id", conn.id).then(() => {});
    return done(Array.isArray(r.json) ? (r.json as ProductionRecord[]) : [], null);
  });

function endpointFn(kind: "Scrap" | "Rework" | "ProductionOee" | "ProductionState") {
  return createServerFn({ method: "GET" })
    .inputValidator((input: { startDate: string; endDate: string }) =>
      z.object({ startDate: z.string(), endDate: z.string() }).parse(input),
    )
    .handler(async ({ data }): Promise<{ data: unknown; error: string | null }> => {
      const { getActiveMesConnection, fetchMes } = await import("./mes.server");
      const conn = await getActiveMesConnection();
      if (!conn) return { data: null, error: "Conexão MES não configurada" };
      const r = await fetchMes(conn, kind, data.startDate, data.endDate);
      return r.ok ? { data: r.json, error: null } : { data: null, error: r.error };
    });
}

export const getScrap = endpointFn("Scrap");
export const getRework = endpointFn("Rework");
export const getOee = endpointFn("ProductionOee");
export const getProductionState = endpointFn("ProductionState");
