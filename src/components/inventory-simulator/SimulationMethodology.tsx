import { formatarNumero } from "@/lib/twin-math";
import type { SimulationBatch } from "@/lib/inventorySimulation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-border bg-secondary/40 px-3 py-2 font-mono text-xs">
      {children}
    </p>
  );
}

export function SimulationMethodology({ batch }: { batch: SimulationBatch }) {
  const t = batch.tecnico;
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="metodologia">
        <AccordionTrigger className="text-sm font-semibold uppercase tracking-[0.2em]">
          Metodologia e memória de cálculo
        </AccordionTrigger>
        <AccordionContent className="space-y-4 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Snapshot único:</strong> todos os cenários deste
              lote usam os mesmos dados congelados no momento do clique, sem nova consulta ao MES.
            </li>
            <li>
              <strong className="text-foreground">Produção típica:</strong> coeficiente angular da
              mesma regressão linear usada pelo gráfico principal, limitado a zero.
            </li>
            <li>
              <strong className="text-foreground">Produção reduzida/elevada:</strong> percentis 25%
              e 75% da média móvel de sete dias da produção diária real.
            </li>
            <li>
              <strong className="text-foreground">Cenários de consumo:</strong> 80%, 90%, 100%, 110%
              e 120% do consumo informado; consumo zero gera apenas um cenário sem expedição.
            </li>
            <li>
              <strong className="text-foreground">Balanço de estoque:</strong> saldo linear a partir
              do estoque atual com a taxa líquida produção menos consumo.
            </li>
            <li>
              <strong className="text-foreground">Classificação:</strong> saldo negativo é falta,
              acima da capacidade é excesso, entre os dois é adequado.
            </li>
            <li>
              <strong className="text-foreground">Primeiro alerta:</strong> primeiro dia dentro do
              horizonte em que a capacidade é atingida ou o estoque zera.
            </li>
            <li>
              <strong className="text-foreground">Faixa operacional:</strong> intervalo de consumo
              que mantém o saldo entre zero e a capacidade, comum às três produções.
            </li>
            <li>
              <strong className="text-foreground">Interpretação do gráfico:</strong> a área
              sombreada cobre todos os cenários; a linha verde é o saldo esperado.
            </li>
          </ol>

          <div className="grid gap-2 sm:grid-cols-3">
            <Tec label="Q25 (média móvel 7d)" value={formatarNumero(t.q25)} />
            <Tec label="Q75 (média móvel 7d)" value={formatarNumero(t.q75)} />
            <Tec label="Produção típica" value={formatarNumero(t.producaoTipica)} />
            <Tec label="Intercepto" value={t.intercepto.toFixed(2)} />
            <Tec label="R²" value={t.r2.toFixed(4)} />
            <Tec label="Cenários distintos" value={String(batch.cenarios.length)} />
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
              Expressões matemáticas utilizadas
            </h4>
            <Formula>Regressão: Ŷ(d) = β₀ + β₁·d</Formula>
            <Formula>Produção típica: P_tip = max(β₁, 0)</Formula>
            <Formula>Média móvel: q̄₇(t) = (1/n_t) · Σ q(t−j), j = 0..n_t−1</Formula>
            <Formula>Produção reduzida: P_red = max[0, min(Q25(q̄₇), P_tip)]</Formula>
            <Formula>Produção elevada: P_elev = max[P_tip, Q75(q̄₇)]</Formula>
            <Formula>Consumo: C_k = C × {"{0,80; 0,90; 1,00; 1,10; 1,20}"}</Formula>
            <Formula>Consumo zero: C = 0 ⇒ C_k = 0</Formula>
            <Formula>Taxa líquida: L_s = P_s − C_s</Formula>
            <Formula>Estoque: E_s(t) = E₀ + (P_s − C_s)·t</Formula>
            <Formula>Saldo no dia solicitado: E_s(D) = E₀ + (P_s − C_s)·D</Formula>
            <Formula>
              Classificação: E_s(D) &lt; 0 → FALTA; 0 ≤ E_s(D) ≤ E_max → ADEQUADO; E_s(D) &gt; E_max
              → EXCESSO
            </Formula>
            <Formula>Primeiro dia de falta: d_falta = ⌈E₀ / (C − P)⌉, quando C &gt; P</Formula>
            <Formula>
              Primeiro dia de capacidade: d_cap = ⌈(E_max − E₀) / (P − C)⌉, quando P &gt; C
            </Formula>
            <Formula>Faixa operacional: P + (E₀ − E_max)/D ≤ C ≤ P + E₀/D</Formula>
            <Formula>Limites do gráfico: E_inf(t) = min_s E_s(t); E_sup(t) = max_s E_s(t)</Formula>
            <Formula>Linha esperada: E_ref(t) = E₀ + (P_tip − C_esperado)·t</Formula>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
              Referências científicas da metodologia
            </h4>
            <p>
              KLEIJNEN, J. P. C. <em>Design and Analysis of Simulation Experiments</em>. 2. ed.
              Springer, 2015. DOI: 10.1007/978-3-319-18087-8. — fundamenta o desenho de experimentos
              por cruzamento sistemático de fatores (produção × consumo) e a eliminação de
              combinações redundantes.
            </p>
            <p>
              CIMINO, A.; GNONI, M. G.; LONGO, F.; LA ROSA, A. Digital Twin (DT) based methodology
              to support effective design of industrial production lines.{" "}
              <em>Procedia Computer Science</em>, 217, 1896–1907, 2023. DOI:
              10.1016/j.procs.2022.12.390. — sustenta o uso do gêmeo digital alimentado por dados do
              MES para avaliar cenários da linha de produção.
            </p>
            <p>
              TEERASOPONPONG, S.; SOPADANG, A. Decision support system for adaptive sourcing and
              inventory management in small- and medium-sized enterprises.{" "}
              <em>Robotics and Computer-Integrated Manufacturing</em>, 73, 102226, 2022. DOI:
              10.1016/j.rcim.2021.102226. — orienta o formato de apoio à decisão voltado a pequenas
              e médias empresas, com perguntas simples e alertas operacionais.
            </p>
            <p>
              SILVER, E. A.; PYKE, D. F.; THOMAS, D. J.{" "}
              <em>Inventory and Production Management in Supply Chains</em>. 4. ed. CRC Press /
              Taylor &amp; Francis, 2016. — base do balanço de estoque, da classificação entre falta
              e excesso e do cálculo da faixa operacional de consumo.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function Tec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-secondary/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
