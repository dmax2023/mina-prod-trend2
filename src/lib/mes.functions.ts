import { createServerFn } from "@tanstack/react-start";

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
};

export type ProductionSnapshot = {
  fetchedAt: string;
  records: ProductionRecord[];
  error: string | null;
};

export const getProductionCount = createServerFn({ method: "GET" })
  .inputValidator((input: { startDate: string; endDate: string }) => input)
  .handler(async ({ data }): Promise<ProductionSnapshot> => {
    const apiKey = process.env["MES_API_KEY"] ?? "3E32D3C4A36E491AA7E7D911D1096442";
    const url = `https://mina.com.br/integration/v1/ProductionCount/${data.startDate}/${data.endDate}`;

    try {
      const res = await fetch(url, {
        headers: { ApiKey: apiKey, accept: "application/json" },
      });

      if (!res.ok) {
        return {
          fetchedAt: new Date().toISOString(),
          records: [],
          error: `MES respondeu ${res.status}`,
        };
      }

      const json = (await res.json()) as ProductionRecord[];
      return {
        fetchedAt: new Date().toISOString(),
        records: Array.isArray(json) ? json : [],
        error: null,
      };
    } catch {
      return {
        fetchedAt: new Date().toISOString(),
        records: [],
        error: "Falha de comunicação com o MES",
      };
    }
  });
