# Gêmeo Digital de Produção e Estoque — MINA MES

> Gêmeo Digital orientado a dados para monitoramento da produção, análise de tendência, projeção de estoque e simulação de cenários, integrado ao **MINA MES** por API REST.

**Aplicação web:** https://mina-prod-trend.lovable.app/  
**Repositório:** https://github.com/dmax2023/mina-prod-trend

---

## 1. Visão geral

Este projeto implementa um **Gêmeo Digital (GD) de manufatura** que transforma dados de produção coletados no chão de fábrica em informações para monitoramento, análise e apoio à decisão. A solução foi estruturada segundo a lógica funcional da **ISO 23247**, conectando o elemento físico observado, o sistema MES, a camada de aquisição de dados, o núcleo analítico do gêmeo e a interface do usuário.

O fluxo principal é:

```mermaid
flowchart LR
    A[Produto na esteira] --> B[Sensor óptico]
    B --> C[Dispositivo IoT]
    C -->|Wi-Fi| D[MINA MES]
    D -->|API REST / JSON| E[Camada de servidor]
    E --> F[Pré-processamento]
    F --> G[Modelo analítico]
    G --> H[Simulação de cenários]
    H --> I[Dashboard / Apoio à decisão]
    I --> J[Notificações por e-mail]
```

O projeto **não executa controle automático da máquina**. As recomendações são informacionais e a decisão permanece com o usuário.

---

## 2. Objetivos do Gêmeo Digital

A solução foi criada para:

- acompanhar a produção por **centro de trabalho, dia e turno**;
- sincronizar dados do MES de forma periódica;
- identificar padrões de atingimento de metas por meio de **heatmap**;
- estimar a tendência produtiva por regressão linear;
- projetar possíveis saldos de estoque a partir de produção, consumo e capacidade;
- comparar condições de **falta, adequação e excesso**;
- identificar o primeiro alerta de falta ou atingimento da capacidade;
- calcular uma **faixa robusta de consumo**;
- registrar destinatários e encaminhar resultados de simulação por e-mail;
- apoiar decisões sem exigir que o usuário manipule diretamente modelos matemáticos.

### Valor para micro e pequenas empresas

A proposta busca reduzir a barreira de uso de análise industrial ao reutilizar dados já disponíveis em um MES e apresentar os resultados em uma aplicação web. Em empresas que já dispõem de sensoriamento, conectividade e uma API de produção, o GD pode apoiar planejamento de estoque, identificação antecipada de excesso/falta, comparação de hipóteses operacionais e compartilhamento de resultados com gestores sem exigir uma infraestrutura analítica separada para cada usuário.

---

## 3. Arquitetura baseada na ISO 23247

A solução pode ser relacionada às entidades funcionais da ISO 23247 da seguinte forma:

| Entidade / camada | Implementação no projeto |
|---|---|
| **Observable Manufacturing Elements** | linha de produção, produto, sensor óptico, centro de trabalho |
| **Data Collection / Device Communication** | dispositivo IoT, Wi-Fi, MINA MES, API REST |
| **Digital Twin Core** | pré-processamento, série temporal, regressão, simulação, classificação e alertas |
| **User Entity** | dashboard, parâmetros, gráficos, tabelas, heatmap e envio de simulações |
| **Cross-System Functions** | autenticação por API key, validação, persistência, gateway de e-mail e segurança de credenciais |

---

## 4. Tecnologias e frameworks

| Categoria | Tecnologia | Papel no projeto |
|---|---|---|
| Plataforma de desenvolvimento | **Lovable** | desenvolvimento e publicação da aplicação web |
| Frontend / Full-stack | **React 19 + TypeScript** | interface e lógica tipada |
| Framework | **TanStack Start** | funções server-side e aplicação full-stack |
| Rotas | **TanStack Router** | roteamento da aplicação |
| Sincronização e cache | **TanStack React Query** | consultas periódicas, cache e revalidação dos dados do MES |
| UI | **Radix UI** | componentes acessíveis e reutilizáveis |
| Estilização | **Tailwind CSS** | layout responsivo e identidade visual |
| Gráficos | **Recharts** | séries temporais, regressão e envelope de cenários |
| Validação | **Zod** | validação de entradas e payloads de funções de servidor |
| Banco de dados | **Supabase / PostgreSQL** | conexões MES, destinatários e logs de notificação |
| E-mail | **Resend** | envio transacional de resultados |
| Gateway externo | **Lovable Connector Gateway** | mediação segura da chamada ao Resend |
| Build | **Vite** | desenvolvimento e empacotamento |
| Runtime server | **Nitro** | execução das funções no servidor |
| Versionamento | **Git / GitHub** | rastreabilidade do código-fonte |
| Qualidade de código | **ESLint + Prettier** | padronização, lint e formatação |

---

## 5. Integração com o MINA MES

### 5.1 Fonte de dados

A principal fonte do Gêmeo Digital é o endpoint **`ProductionCount`**. O projeto também possui camada de integração preparada para consultar endpoints de **Scrap**, **Rework**, **ProductionOee** e **ProductionState**, embora o fluxo principal atual utilize `ProductionCount`.

Cada registro de produção pode conter, entre outros atributos:

- data;
- turno;
- centro de trabalho;
- produto;
- unidade de medida;
- quantidade boa;
- quantidade total;
- meta de produção;
- timestamp do evento, quando fornecido pelo MES.

### 5.2 Cadastro de conexão

A aplicação possui um módulo **Conexões de API**. Cada conexão contém:

- nome;
- URL base;
- lista de endpoints;
- token/API key;
- situação ativa/inativa;
- data da última sincronização.

Somente **uma conexão MES pode permanecer ativa por vez**. O token é recuperado apenas no servidor e aparece mascarado na interface.

### 5.3 Estratégia de atualização

O fluxo usa:

1. carga histórica inicial;
2. consultas incrementais sobre o período mais recente;
3. reconciliação dos registros por chave composta;
4. atualização do cache da aplicação;
5. recomputação dos indicadores e modelos.

A chave lógica usada para reconciliação combina:

`data + turno + centro de trabalho + produto`.

---

## 6. Sincronização e soft real-time

A versão mais recente do código-fonte define polling de **1 s** (`POLL_MS = 1000`) e um prazo de referência de **1 s** para avaliação da latência ponta a ponta (`D_RT = 1000`). A latência somente é calculada quando o MES fornece um `eventTimestamp` real; o sistema não cria um timestamp artificial para simular desempenho.

> **Nota de versão:** no momento da elaboração deste README, a implantação pública ainda exibia atualização de 5 s. O código anexado contém a configuração de 1 s. Para manter documentação e implantação coerentes, publique a revisão mais recente antes de declarar 1 s no ambiente de produção.

### Latência ponta a ponta

> **Compatibilidade com GitHub:** as expressões abaixo usam blocos `math`, formato suportado pelo renderizador MathJax do GitHub. As fórmulas foram mantidas em uma única linha sempre que possível para evitar quebras e alinhamentos verticais indesejados.

```math
L_i = t_i^{\mathrm{DT}} - t_i^{\mathrm{evento}}
```

onde:

- $t^{evento}_i$: instante registrado para o evento de produção;
- $t^{DT}_i$: instante de recebimento pelo Gêmeo Digital;
- $L_i$: latência ponta a ponta do evento $i$.

A condição de conformidade é:

```math
L_i \leq D_{\mathrm{RT}}
```

A aplicação mantém até 500 amostras e apresenta **P50, P95, P99, máximo e percentual de eventos dentro de 1 s**.

```math
C_{\mathrm{RT}} = \frac{100}{N} \sum_{i=1}^{N} \mathbb{I}\!\left(L_i \leq D_{\mathrm{RT}}\right)
```

A denominação **soft real-time** deve ser usada somente quando a latência puder ser efetivamente medida. Sem `eventTimestamp`, a interpretação correta é sincronização periódica / near-real-time.

---

## 7. Pré-processamento dos dados

O pré-processamento ocorre antes da modelagem:

1. filtra registros válidos e o centro de trabalho selecionado;
2. converte quantidades para valores numéricos;
3. agrega a produção por dia;
4. ordena os registros cronologicamente;
5. completa datas ausentes com produção igual a zero;
6. seleciona a janela histórica solicitada pelo usuário;
7. calcula a produção acumulada e séries suavizadas.

### Produção diária consolidada

```math
P_d = \sum_{i \in R_d} q_i
```

onde $R_d$ é o conjunto de registros do dia $d$ e $q_i$ a quantidade do registro $i$.

### Nota conceitual importante

No código legado, a propriedade `estoque` da série principal representa a soma acumulada da produção. Academicamente, essa variável deve ser interpretada como **produção acumulada**, e não como estoque físico medido:

```math
A_t = \sum_{i=1}^{t} P_i
```

O **saldo de estoque projetado** somente é definido quando estoque inicial, produção e consumo são combinados na simulação, conforme a Eq. (11).

---

## 8. Modelo analítico

### 8.1 Média móvel

A interface principal suaviza a série acumulada por uma janela de até sete dias. O simulador também calcula média móvel de sete dias sobre a **produção diária** para obter os percentis usados nos níveis reduzido e elevado.

```math
\bar{q}_7(t) = \frac{1}{n_t} \sum_{j=0}^{n_t-1} q(t-j)
```

### 8.2 Regressão linear

A tendência é ajustada por mínimos quadrados:

```math
\widehat{A}_t = \beta_0 + \beta_1 t
```

onde:

- $\beta_0$: intercepto;
- $\beta_1$: inclinação/tendência produtiva;
- $\widehat{A}_t$: produção acumulada estimada.

O sistema também apresenta $R^2$ como medida de aderência do ajuste histórico. **$R^2$ não deve ser interpretado isoladamente como validação de capacidade preditiva fora da amostra.**

---

## 9. Geração dos cenários de estoque

O simulador congela um **snapshot único** dos dados no momento do clique. Isso impede que uma nova atualização do MES altere a base enquanto os cenários de um mesmo lote estão sendo comparados.

### 9.1 Níveis de produção

```math
P_{\mathrm{tip}} = \max(\beta_1,0) \qquad P_{\mathrm{red}} = \max\!\left[0,\min(Q_{25},P_{\mathrm{tip}})\right] \qquad P_{\mathrm{elev}} = \max(P_{\mathrm{tip}},Q_{75})
```

- **Típica:** inclinação positiva da regressão;
- **Reduzida:** limitada pelo percentil 25 da média móvel da produção diária;
- **Elevada:** limitada pelo percentil 75 da média móvel da produção diária.

### 9.2 Níveis de consumo

```math
C_k = \rho_k C, \qquad \rho_k \in \{0.80,\,0.90,\,1.00,\,1.10,\,1.20\}
```

Quando $C=0$, é gerado apenas um cenário de **sem expedição**.

O cruzamento de 3 níveis de produção com 5 níveis de consumo gera até **15 cenários**, com remoção de combinações numericamente duplicadas.

### 9.3 Taxa líquida

```math
L_s = P_s - C_s
```

### 9.4 Saldo de estoque projetado

```math
E_s(t) = E_0 + (P_s-C_s)t
```

onde:

- $E_0$: estoque físico disponível informado pelo usuário;
- $P_s$: produção do cenário;
- $C_s$: consumo do cenário;
- $t$: horizonte;
- $E_s(t)$: saldo projetado.

### 9.5 Classificação

```math
E_s(D)<0 \Rightarrow \mathrm{FALTA} \qquad 0\leq E_s(D)\leq E_{\max} \Rightarrow \mathrm{ADEQUADO} \qquad E_s(D)>E_{\max} \Rightarrow \mathrm{EXCESSO}
```

### 9.6 Primeiro alerta

Se $C_s>P_s$ (risco de falta):

```math
d_{\mathrm{alert}} = \left\lceil \frac{E_0}{C_s-P_s} \right\rceil
```

Se $P_s>C_s$ (risco de atingir a capacidade):

```math
d_{\mathrm{alert}} = \left\lceil \frac{E_{\max}-E_0}{P_s-C_s} \right\rceil
```

### 9.7 Faixa operacional de consumo

```math
P_s + \frac{E_0-E_{\max}}{D} \leq C \leq P_s + \frac{E_0}{D}
```

A interseção das faixas obtidas para produção reduzida, típica e elevada é apresentada como **faixa de consumo robusta**.

### 9.8 Envelope dos cenários

```math
E_{\inf}(t) = \min_s E_s(t) \qquad E_{\sup}(t) = \max_s E_s(t)
```

A linha de referência utiliza produção típica e consumo informado:

```math
E_{\mathrm{ref}}(t) = E_0 + (P_{\mathrm{tip}}-C)t
```

---

## 10. Heatmap de produção

O heatmap resume o atingimento de meta por **dia da semana × centro de trabalho × turno**.

```math
\mathrm{Atingimento}(\%) = \frac{Q_{\mathrm{produzida}}}{Q_{\mathrm{meta}}} \times 100
```

A produção utiliza preferencialmente `goodQuantity`; na ausência desse valor, utiliza `totalQuantity`.

O heatmap é útil para identificar:

- turnos com menor desempenho;
- dias recorrentes de baixa produção;
- diferenças entre centros de trabalho;
- períodos em que a meta é mais ou menos atingida.

---

## 11. Funcionalidades presentes

### Monitoramento

- status da conexão MES;
- última sincronização;
- quantidade de registros;
- centros de trabalho identificados;
- produção acumulada;
- tendência produtiva;
- métricas de sincronização quando existe timestamp de evento.

### Visualização

- heatmap de produção;
- gráfico histórico;
- média móvel;
- regressão linear;
- limite de estoque;
- marcador do horizonte escolhido.

### Simulação

- horizonte de previsão;
- estoque inicial;
- consumo-base;
- capacidade máxima;
- até 15 cenários;
- envelope dos cenários;
- cenário esperado;
- classificação falta/adequado/excesso;
- primeiro alerta;
- faixa robusta de consumo.

### Comunicação

- cadastro de destinatários;
- habilitação/desabilitação de notificações;
- envio por Resend;
- registro de sucesso/falha em `notification_logs`.

### Administração da fonte de dados

- cadastrar conexão MES;
- editar URL, endpoints e token;
- testar conexão;
- ativar/desativar a fonte oficial;
- excluir conexão;
- acompanhar a última sincronização.

---

## 12. Jornada do usuário

### Etapa 1 — Configurar a fonte MES

1. Acesse **Conexões de API**.
2. Clique em **Nova conexão**.
3. Informe nome, URL base, endpoints e API key.
4. Salve e use **Testar conexão**.
5. Marque a conexão desejada como **Ativa**.

> Apenas a conexão ativa alimenta o Gêmeo Digital.

### Etapa 2 — Verificar a sincronização

Observe o painel **Sincronização MES ↔ Gêmeo Digital**.

Quando o MES fornece timestamp do evento, verifique:

- latência E2E;
- P50;
- P95;
- P99;
- máximo;
- percentual de eventos dentro de 1 s.

Se aparecer **TIMESTAMP INDISPONÍVEL**, os dados continuam sendo atualizados, mas a conformidade soft real-time não pode ser demonstrada.

### Etapa 3 — Explorar a produção

Use:

- KPIs para visão geral;
- heatmap para comparar dias e turnos;
- seleção de centro de trabalho para análise específica;
- opção **Todos** para visão consolidada.

### Etapa 4 — Configurar a análise principal

| Campo | Como usar |
|---|---|
| **Centro de trabalho** | escolha a linha que deseja analisar ou `Todos` |
| **Dias observados** | define a janela histórica usada no ajuste |
| **Dia que deseja verificar** | horizonte futuro da projeção principal |
| **Consumo de estoque diário** | saída diária assumida |
| **Limite máximo de estoque** | capacidade/política usada como referência |

### Etapa 5 — Executar a simulação automática

No módulo de cenários, informe:

| Campo | Recomendação |
|---|---|
| **Centro de trabalho** | mantenha coerência com a linha operacional estudada |
| **Prever estoque no dia** | escolha o horizonte relacionado à decisão que precisa tomar |
| **Estoque disponível hoje** | use contagem física ou valor oficial do estoque atual |
| **Quanto costuma sair por dia** | use média real de consumo/expedição, não um valor arbitrário |
| **Capacidade máxima** | use limite físico, contratual ou operacional real |

Clique em **Simular cenários**. O sistema calcula automaticamente as variações de produção e consumo.

### Etapa 6 — Interpretar o resultado

Priorize quatro perguntas:

1. **Há cenários de falta?**  
   Indicam que consumo pode superar produção e estoque inicial dentro do horizonte.

2. **Há cenários de excesso?**  
   Indicam possibilidade de ultrapassar a capacidade informada.

3. **Qual é o primeiro alerta?**  
   Mostra o instante estimado para falta ou capacidade.

4. **Existe faixa robusta de consumo?**  
   Representa o intervalo de consumo que mantém o saldo dentro dos limites nas três condições de produção.

### Etapa 7 — Compartilhar a análise

1. Cadastre os destinatários.
2. Habilite **Receber notificações**.
3. Execute a simulação.
4. Clique em **Enviar simulação**.

A aplicação envia parâmetros, resultados, cenários e informações técnicas por e-mail.

---

## 13. Como escolher parâmetros adequados

Os parâmetros devem representar condições reais ou hipóteses claramente justificadas.

### Janela histórica

- use uma janela curta quando houver mudança recente de processo;
- use uma janela maior quando a produção for relativamente estável;
- evite misturar longos períodos com condições produtivas estruturalmente diferentes;
- compare o $R^2$ apenas como aderência histórica, não como garantia de previsão futura.

### Horizonte

O horizonte deve acompanhar o ciclo decisório:

- curto prazo: programação operacional;
- médio prazo: planejamento de produção e expedição;
- horizonte maior: somente quando a estabilidade do processo justificar a extrapolação.

Quanto maior o horizonte, maior o efeito acumulado de pequenas diferenças entre produção e consumo.

### Estoque inicial

Use o estoque físico mais recente. A qualidade da projeção de estoque depende diretamente de $E_0$.

### Consumo

Use preferencialmente:

- média histórica de expedição;
- pedidos confirmados convertidos em demanda diária;
- política formal de consumo da empresa.

O simulador cria automaticamente níveis de 80%, 90%, 100%, 110% e 120% do valor-base.

### Capacidade

Pode representar:

- capacidade física do armazém;
- limite de segurança;
- limite de capital imobilizado definido pela empresa;
- política interna de estoque máximo.

Se o valor utilizado não for um limite físico, documente sua origem para evitar interpretações incorretas.

---

## 14. Persistência de dados

O Supabase/PostgreSQL mantém estruturas auxiliares da aplicação:

| Tabela | Finalidade |
|---|---|
| `mes_connections` | conexões MES, endpoints, token, situação e última sincronização |
| `notification_recipients` | nome, e-mail e habilitação dos destinatários |
| `notification_logs` | rastreabilidade dos envios e falhas de e-mail |

Os registros de produção do MES são consultados pela API e mantidos no estado/cache da aplicação; o Supabase não atua, na implementação atual, como repositório intermediário da série histórica de produção.

---

## 15. Segurança e boas práticas

O projeto adota algumas decisões importantes:

- API keys do MES são usadas apenas em funções server-side;
- token exibido na interface é mascarado;
- somente uma conexão MES pode ser marcada como fonte oficial;
- entradas são validadas com Zod;
- operações administrativas usam cliente Supabase server-side;
- chaves de serviço não devem ser expostas ao navegador;
- logs de envio permitem rastrear falhas de notificação;
- cache de produção é descartado quando a fonte MES é trocada;
- código utiliza TypeScript, ESLint e Prettier para consistência.

### Atenção importante

**Nunca publique tokens, API keys ou arquivos `.env` no GitHub.** O README anterior continha credenciais em texto claro. Qualquer chave que já tenha sido versionada publicamente deve ser considerada comprometida e rotacionada no serviço correspondente.

---

## 16. Instalação local

### Pré-requisitos

- Node.js compatível com Vite/TanStack Start;
- npm, pnpm ou Bun;
- projeto Supabase configurado;
- acesso a uma API MES compatível;
- conta/integração Resend, caso o envio de e-mail seja utilizado.

### Clone

```bash
git clone https://github.com/dmax2023/mina-prod-trend.git
cd mina-prod-trend
```

### Dependências

Com npm:

```bash
npm install
```

ou com Bun:

```bash
bun install
```

### Variáveis de ambiente

Crie seu próprio `.env` local. Não copie credenciais de ambientes públicos.

```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
LOVABLE_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

Algumas variáveis podem ser injetadas automaticamente pelo Lovable Cloud em implantação gerenciada.

### Desenvolvimento

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Formatação

```bash
npm run format
```

---

## 17. Estrutura principal do projeto

```text
src/
├── components/
│   ├── ConexoesApi.tsx
│   ├── DestinatariosSimulacao.tsx
│   ├── HeatmapProducao.tsx
│   ├── SyncMes.tsx
│   └── inventory-simulator/
│       ├── InventorySimulator.tsx
│       ├── SimulationChart.tsx
│       ├── SimulationMethodology.tsx
│       ├── SimulationSummary.tsx
│       └── SimulationTable.tsx
├── integrations/supabase/
├── lib/
│   ├── connections.functions.ts
│   ├── inventorySimulation.ts
│   ├── mes.functions.ts
│   ├── mes.server.ts
│   ├── notifications.functions.ts
│   ├── recipients.functions.ts
│   ├── simulation.ts
│   └── twin-math.ts
└── routes/
    └── index.tsx
```

---

## 18. Limitações atuais

Para interpretar corretamente os resultados:

- a produção futura é representada por tendência linear;
- produção e consumo são considerados constantes dentro de cada cenário;
- o consumo-base é informado pelo usuário;
- o estoque físico histórico não é atualmente fornecido pelo MES usado no estudo;
- o $R^2$ mede ajuste histórico e não substitui validação fora da amostra;
- MAE/MAPE/RMSE de backtesting não estão implementados no fluxo operacional atual;
- sazonalidade, indisponibilidade, troca de produto e variáveis exógenas não são explicitamente modeladas;
- a solução não executa atuação automática sobre o processo físico;
- a comprovação de soft real-time depende da existência de timestamp real do evento no MES.

---

## 19. Próximas evoluções recomendadas

- implementar **rolling-origin backtesting** com MAE e métricas adequadas ao conjunto de dados;
- utilizar série histórica real de estoque e expedição, quando disponível;
- substituir nomenclaturas legadas de `estoque acumulado` por `produção acumulada` na visão principal;
- incorporar modelos não lineares somente quando apresentarem ganho fora da amostra;
- integrar variáveis exógenas relevantes, como pedidos, lead time e indisponibilidade;
- avaliar comunicação orientada a eventos (MQTT/WebSocket) quando houver necessidade de menor latência;
- ampliar integração dos endpoints de refugo, retrabalho, OEE e estado de produção;
- adicionar testes unitários para funções matemáticas e regras de classificação.

---

## 20. Referências metodológicas

Referências relacionadas ao desenvolvimento e às decisões metodológicas empregadas:

[1] ISO, “Automation systems and integration—Digital twin framework for manufacturing—Part 1: Overview and general principles,” **ISO 23247-1:2021**, Geneva, Switzerland, 2021.

[2] ISO, “Automation systems and integration—Digital twin framework for manufacturing—Part 2: Reference architecture,” **ISO 23247-2:2021**, Geneva, Switzerland, 2021.

[3] J. P. C. Kleijnen, *Design and Analysis of Simulation Experiments*, 2nd ed. Cham, Switzerland: Springer, 2015, doi: 10.1007/978-3-319-18087-8.

[4] A. Cimino, M. G. Gnoni, F. Longo, and A. La Rosa, “Digital Twin (DT) based methodology to support effective design of industrial production lines,” *Procedia Computer Science*, vol. 217, pp. 1896–1907, 2023, doi: 10.1016/j.procs.2022.12.390.

[5] S. Teerasoponpong and A. Sopadang, “Decision support system for adaptive sourcing and inventory management in small- and medium-sized enterprises,” *Robotics and Computer-Integrated Manufacturing*, vol. 73, Art. no. 102226, 2022, doi: 10.1016/j.rcim.2021.102226.

[6] E. A. Silver, D. F. Pyke, and D. J. Thomas, *Inventory and Production Management in Supply Chains*, 4th ed. Boca Raton, FL, USA: CRC Press, 2016.

---

## 21. Interpretação resumida

A lógica do projeto pode ser resumida em quatro etapas:

**Observar → Sincronizar → Simular → Decidir**

1. **Observar:** sensor, IoT e MES registram o processo produtivo.
2. **Sincronizar:** a aplicação consulta a fonte MES e atualiza sua representação digital.
3. **Simular:** produção histórica é transformada em níveis produtivos e combinada com hipóteses de consumo.
4. **Decidir:** o usuário compara falta, adequação, excesso, alertas e faixa operacional antes de agir no processo real.

---

## 22. Licença e uso

Defina explicitamente uma licença no repositório antes de reutilização por terceiros. Na ausência de um arquivo `LICENSE`, o código permanece protegido pelas regras padrão de copyright e não deve ser assumido como software livre.

---

**Status:** protótipo funcional de pesquisa e apoio à decisão industrial.  
**Escopo:** monitoramento, análise, projeção e simulação; sem controle automático do processo físico.
