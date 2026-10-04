export type SyncInfo = {
  requestedAt: string;
  receivedAt: string;
  eventTimestamp: string | null;
  amostras: number[];
  erro: string | null;
};

const D_RT = 1000;

function pct(v: number[], p: number) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? null;
}
const ms = (v: number | null) =>
  v === null ? "—" : v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(2)} s`;
const hora = (s: string | null) => (s ? new Date(s).toLocaleTimeString("pt-BR") : "—");

export function SyncMes({
  conexao,
  info,
  semConexao,
}: {
  conexao: string | null;
  info: SyncInfo | null;
  semConexao: boolean;
}) {
  const a = info?.amostras ?? [];
  const latencia =
    info?.eventTimestamp ? Date.parse(info.receivedAt) - Date.parse(info.eventTimestamp) : null;
  const idade = info?.eventTimestamp ? Date.now() - Date.parse(info.eventTimestamp) : null;
  const dentro = a.length ? (a.filter((x) => x <= D_RT).length / a.length) * 100 : null;

  let status: { txt: string; cls: string };
  if (semConexao) status = { txt: "CONEXÃO MES NÃO CONFIGURADA", cls: "bg-destructive" };
  else if (info?.erro) status = { txt: "FALHA NA CONEXÃO MES", cls: "bg-destructive" };
  else if (latencia === null) status = { txt: "TIMESTAMP INDISPONÍVEL", cls: "bg-muted-foreground" };
  else if (latencia <= D_RT) status = { txt: `SINCRONIZADO — ${ms(latencia)}`, cls: "bg-success" };
  else status = { txt: `ATRASO — ${ms(latencia)}`, cls: "bg-destructive" };

  const itens: [string, string][] = [
    ["Conexão ativa", conexao ?? "Nenhuma"],
    ["Último evento MES", hora(info?.eventTimestamp ?? null)],
    ["Recebido pelo gêmeo", hora(info?.receivedAt ?? null)],
    ["Latência E2E", ms(latencia)],
    ["Idade do dado", ms(idade)],
    ["P50", ms(pct(a, 50))],
    ["P95", ms(pct(a, 95))],
    ["P99", ms(pct(a, 99))],
    ["Máximo", ms(a.length ? Math.max(...a) : null)],
    ["Eventos ≤ 1 s", dentro === null ? "—" : `${dentro.toFixed(1)}%`],
    ["Amostras", String(a.length)],
  ];

  return (
    <section className="mx-auto mt-6 max-w-7xl">
      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Sincronização MES ↔ Gêmeo Digital
          </h2>
          <span className="flex items-center gap-2 text-xs font-semibold tracking-widest">
            <span className={`inline-block size-2.5 rounded-full ${status.cls}`} />
            {status.txt}
          </span>
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
          {itens.map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
