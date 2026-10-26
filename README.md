# MES-Integrated Digital Twin for Inventory Projection and Scenario Analysis

**Data-Driven MES-Integrated Digital Twin for Inventory Projection and Scenario Analysis**

> A digital manufacturing research prototype that integrates production data from a Manufacturing Execution System (MES), visualization, inventory projection, scenario simulation, and alerts, following the functional organization of ISO 23247.

**Web application:** https://mina-prod-trend.lovable.app/  
**Current public repository:** https://github.com/dmax2023/mina-prod-trend2  
**Case study:** industrial mineral water bottling line, Recife Metropolitan Area, Pernambuco, Brazil.  
**Status:** functional decision-support prototype; **does not control equipment** and **has not been validated for predictive accuracy against observed inventory levels**.

> **Access and data note:** When the application is opened without a configured MES connection, indicators may display zero values and some results may be unavailable. This does not represent the experimental dataset reported in the paper. The study used industrial records obtained through an authorized connection.

## Table of Contents

1. [Overview and Scope](#1-overview-and-scope)
2. [Industrial Case Study and Architecture](#2-industrial-case-study-and-architecture)
3. [Features and Modules](#3-features-and-modules)
4. [MINA MES Integration](#4-mina-mes-integration)
5. [Synchronization and Latency](#5-synchronization-and-latency)
6. [Mathematical Models](#6-mathematical-models)
7. [Manual Simulator](#7-manual-simulator)
8. [Automatic Simulator and Alerts](#8-automatic-simulator-and-alerts)
9. [Methodology and Experimental Evaluation](#9-methodology-and-experimental-evaluation)
10. [Experimental Results](#10-experimental-results)
11. [How to Use](#11-how-to-use)
12. [Technologies and Installation](#12-technologies-and-installation)
13. [Reproducibility, Security, and Limitations](#13-reproducibility-security-and-limitations)
14. [Future Work, References, and License](#14-future-work-references-and-license)

## 1. Overview and Scope

This project proposes a data-driven **Digital Twin (DT)**, accessible through a web browser, to analyze operational inventory conditions using real production records. A bottling line is monitored by sensors and IoT devices; records are made available through the **MINA MES** and retrieved by the application via a REST API. The DT aggregates time series, provides visualizations, calculates projected inventory trajectories, and generates classifications and alerts.

The main features include:

- periodic retrieval of MES production data and selection of work centers (WCs);
- indicators, time-series charts, linear regression, and a production target achievement heatmap;
- a **manual simulator** comparing up to 15 production × consumption scenarios;
- an **automatic simulator** for periodic projections and identification of preventive and risk ranges;
- settings for capacity, initial inventory, projection horizon, and consumption;
- emailing of results and notifications to registered recipients;
- experimental implementation verification and sensitivity analysis documented in the scientific study.

**Scope limitation:** Results are conditional projections based on the specified parameters. The DT does not directly control the conveyor, PLC, or production system. Decisions and physical changes remain the operator's responsibility.

## 2. Industrial Case Study and Architecture

### 2.1 Case Study

The study examined a Brazilian mineral water manufacturer bottling **20 L polycarbonate water bottles (Line 1)** and **10 L bottles (Line 3)**. Between January 2025 and October 2026, the paper reports an average daily production of approximately **10,000 20 L bottles** on Line 1 and **7,000 10 L bottles** on Line 3. These figures characterize the case study; they are not demonstration data automatically available to every website visitor.

### 2.2 Functional Flow

```mermaid
flowchart LR
    A[Bottle on conveyor] --> B[Through-beam optical sensor]
    B --> C[IoT device]
    C -->|Wi-Fi| D[MINA MES / Work center]
    D -->|ProductionCount / REST API| E[Web application / Digital Twin]
    E --> F[Processing and models]
    F --> G[Manual simulator]
    F --> H[Automatic simulator]
    G --> I[Results and analysis]
    H --> I
    I --> J[Alerts / notifications]
```

### 2.3 Functional Mapping to ISO 23247

ISO 23247 is used as a **reference for functional organization**, without claiming certification of full compliance.

| Domain / function | Representation in this solution |
|---|---|
| *Observable Manufacturing Domain* | Bottling conveyor, bottles, counting sensor, and WCs |
| *Device Communication Domain* | Signal acquisition, IoT, Wi-Fi, MES, and REST interface |
| *Digital Twin Domain* | Processing, time series, regression, simulation, classification, and alerts |
| *User Domain* | Dashboard, parameter controls, charts, tables, and notifications |
| Cross-cutting functions | Data translation and quality, authentication, credential protection, and traceability |

## 3. Features and Modules

| Module | Functions | Requirements |
|---|---|---|
| MES monitoring | Cumulative production, WCs, observed window, updates, and connection status | Requires an active MES connection |
| Heatmap | Target achievement by weekday, WC, and shift | Depends on available targets and production data |
| Trend / regression | Historical visualization, smoothing, and linear trend | Depends on valid records |
| Manual simulator | Reduced/typical/increased production × consumption; final inventory; first alert | Requires user-specified parameters |
| Automatic simulator | Periodic projection, minimum/maximum limits, and preventive ranges | Requires parameters and, for historical consumption, outflow records |
| Notifications | Recipient registration, simulation emails, and alerts | Requires configured email delivery and enabled recipients |
| API connections | MES source registration, activation, and verification | Requires a valid endpoint and authorization |

### 3.1 Cumulative Production Versus Physical Inventory

**Cumulative production is not necessarily equivalent to physical inventory.** A legacy visualization variable may be named `estoque` even though it represents the sum of production quantities. The **projected inventory balance** results from explicitly combining initial inventory, production inflows, and consumption outflows. Cumulative production must not be interpreted as measured inventory.

## 4. MINA MES Integration

The primary production data source is the MINA MES **`ProductionCount`** endpoint. Earlier documentation also describes integration structures for `Scrap`, `Rework`, `ProductionOee`, and `ProductionState`; these endpoints were not considered active data sources in the experiment reported in the paper.

A record may include date, shift, WC, product, unit of measure, produced quantity, good quantity, and production target, depending on the fields exposed by the API. The application supports registration of a connection name, base URL, endpoints, and access key, with one active source selected at a time.

The data-processing flow documented in the project is:

1. authenticate and query the active connection;
2. retrieve historical and incremental records;
3. validate, filter, and aggregate data by period and WC;
4. update application cache/state and visualizations;
5. calculate indicators and simulations using the available data.

A logical reconciliation key described in the project documentation combines **date + shift + WC + product**. Its actual use should be checked in the deployed version whenever the API changes.

## 5. Synchronization and Latency

The public interface inspected in October 2026 indicates **1-second polling** for the active MES connection. This is a *configured query interval*, not evidence that every physical event reaches the interface within one second.

The observed `ProductionCount` endpoint provides records aggregated by day/shift and does not necessarily expose a source `eventTimestamp` with sufficient time resolution. In this situation, the dashboard shows **TIMESTAMP UNAVAILABLE**, and end-to-end latency between the physical event and the DT cannot be validly computed. API response time is not a substitute for this measurement.

When a reliable source timestamp is available, latency may be defined as:

```math
L_i = t_i^{\mathrm{DT}} - t_i^{\mathrm{event}}
```

For a reference threshold `D_RT`:

```math
C_{\mathrm{RT}} = \frac{100}{N} \sum_{i=1}^{N} \mathbb{I}(L_i \leq D_{\mathrm{RT}})
```

The interface provides places for indicators such as P50, P95, P99, maximum latency, and the percentage of events within the threshold, but **these must not be treated as measured results when source timestamps are unavailable**. In that situation, the more appropriate term is *periodic synchronization* or *near-real-time*.

## 6. Mathematical Models

### 6.1 Daily and Cumulative Production

Daily production is obtained by aggregating valid records, while cumulative production is given by:

```math
A_t = \sum_{i=1}^{t} P_i
```

The linear trend can be represented as:

```math
\widehat{A}_t = \beta_0 + \beta_1 t
```

The historical fitting coefficient `R²` **does not, by itself, measure out-of-sample predictive accuracy**.

### 6.2 Inventory Balance

For a scenario with daily production `P_s`, daily consumption `C_s`, and initial inventory `E_0`:

```math
E_s(t) = E_0 + (P_s-C_s)t
```

- `E_s(t)` is the projected inventory balance on day `t`;
- `E_0` is the specified initial inventory;
- `P_s` and `C_s` are the scenario's production and consumption rates.

Capacity and coverage can be related through the experimental parameterization:

```math
E_{\max} = P_{\mathrm{ref}} D_{\mathrm{coverage}}
```

This expression defines a **parameterized operating capacity** in the experiment; it does not replace measurement of the facility's actual physical limit.

### 6.3 Manual Simulator Classification

```math
E_s(H) < 0 \Rightarrow \mathrm{SHORTAGE}
```

```math
0 \leq E_s(H) \leq E_{\max} \Rightarrow \mathrm{ADEQUATE}
```

```math
E_s(H) > E_{\max} \Rightarrow \mathrm{EXCESS}
```

Here, `H` is the projection horizon. The first day of shortage or capacity exceedance is determined from the discretized trajectory and its limits; displayed values may be subject to rounding rules defined in the implementation.

## 7. Manual Simulator

The module allows the user to select the **WC, projection horizon, initial inventory, daily consumption, and capacity**. Each run freezes a *snapshot* of the available data so scenarios can be compared against the same temporal reference.

The documented logic combines:

- three production levels: **reduced**, **typical**, and **increased**;
- five relative consumption levels: **80%, 90%, 100%, 110%, and 120%** of baseline consumption;
- up to **15 internal scenarios**, removing numerically duplicate combinations.

When baseline consumption is zero, equivalent consumption scenarios are consolidated. Results include daily production and consumption, final inventory balance, classification (*shortage*, *adequate*, or *excess*), first alert, and comparison of trajectories. A simulation can also be emailed to registered recipients.

Typical and alternative production rates are derived from regression and historical variation. Earlier documentation defines the typical rate using a nonnegative slope and the alternative levels using percentiles of a seven-day moving average. These mechanisms should be interpreted as scenario assumptions, **not individually validated forecasts**.

## 8. Automatic Simulator and Alerts

The **Automatic Simulator** allows configuration of WC, projection horizon, initial inventory, minimum and maximum inventory, and consumption handling. After automatic mode is enabled, the application updates the projected trajectory according to its queries and execution conditions. An immediate manual refresh command is also available.

In the study, the reference production rate was based on the **average of the last seven valid production days**. The model uses the cumulative inventory balance and preventive conditions near the limits. The five displayed states are:

| State | Interpretation |
|---|---|
| **Lower risk** | Inventory below the lower safety range |
| **Near minimum** | Approaching the lower limit / preventive region |
| **Adequate** | Within the central range considered acceptable |
| **Near maximum** | Approaching the upper limit / preventive region |
| **Upper risk** | Exceedance or upper-risk condition |

The limits are configurable. The experimental documentation describes lower and upper limits and preventive regions; therefore, results depend on user-defined values and the rules implemented in the running version.

### 8.1 Historical Consumption: Important Constraint

The interface includes the **“Consider inventory outflows”** option, with configurable historical windows. However, **the experimental dataset described in the paper did not contain real historical shipping/consumption data or physical inventory records**, so the automatic simulator used **zero consumption in its calculations**. This **does not mean that the factory had no actual consumption or shipments**.

Consequently, the automatic simulator experiments verify its mathematics and behavior **under this specific condition**, but not its predictive accuracy when actual outflows are different from zero.

### 8.2 Email Notifications

The module supports automatic alerts based on risk conditions and notification settings. Delivery depends on the email integration (for example, Resend), authorized credentials, application delivery rules, and registered recipients.

## 9. Methodology and Experimental Evaluation

The scientific study is organized into **four phases**:

| Phase | Purpose |
|---|---|
| **1. Problem characterization** | Understand the process and products, monitored WCs, infrastructure, and DT scope |
| **2. DT development** | Map physical and virtual elements, integrate the REST API, and implement projections, simulations, and alerts |
| **3. Experimental evaluation** | Run scenarios, verify the implementation against independent equations, and analyze sensitivity |
| **4. Decision support and improvements** | Interpret alerts and inventory conditions and support planning adjustments |

### 9.1 Manual Simulator Experimental Design

- **1,000 runs with distinct configurations**, selected from **42,336 possible combinations** using a deterministic modular permutation (step size 37 and initial offset 17);
- variation in WCs (Line 1, Line 3, and both), observed production window, projection horizon, inventory coverage, initial inventory, and consumption;
- up to 15 scenarios generated per run, with redundant outputs removed;
- **13,645 projections** after deduplication.

### 9.2 Automatic Simulator Experimental Design

- **1,000 total runs**, comprising **900 distinct configurations** and **100 controlled repetitions** to test deduplication;
- projection horizons of **7, 15, 30, 45, 60, and 90 days**;
- inventory coverage levels of **5, 10, 20, 30, 45, and 60 days**;
- variation in WC, initial inventory, minimum inventory mode, and consumption option;
- trajectory calculated using recent reference production;
- **zero consumption in the calculations** because historical outflow records were unavailable.

### 9.3 Verification and Sensitivity

Independent verification compared final inventory (manual) and trajectories (automatic) with inventory balance equations. The study examined `R²`, `MAE`, `RMSE`, absolute errors, error relative to capacity, rounding, classifications, alerts, and monotonicity.

Sensitivity analysis used the **Kruskal–Wallis test with epsilon-squared**, **permutation importance with Extra Trees and five-fold cross-validation**, and **Spearman correlation**. The response variables were the proportion of adequate scenarios in the manual simulator and the final inventory-to-capacity ratio in the automatic simulator.

**Important:** mathematical verification must not be confused with validation of predictive accuracy against real inventory data.

## 10. Experimental Results

The figures in this section are **results reported in the paper**, not metrics calculated automatically by the dashboard when a visitor opens the website.

### 10.1 Mathematical Verification

| Metric | Manual | Automatic |
|---|---:|---:|
| Evaluated projections / runs | 13,645 projections | 1,000 runs |
| `R²` (analytical reference × simulator) | 0.999999992 | 0.9999999992 |
| MAE | 13.38 units | 10.07 units |
| RMSE | 19.58 units | 13.44 units |
| Median absolute error | 8.00 units | 8.31 units |
| Maximum absolute error | 86.00 units | 42.31 units |
| Mean error relative to capacity | 0.0128% | 0.00677% |
| Rounding tolerance violations | 0 | 0 |

The study reports **100% agreement** with the verified classification rules, consumption ranges, and alerts for the manual simulator and **100% monotonicity** in the automatic simulator's trajectories.

### 10.2 Classification Distribution

**Manual (13,645 scenarios):**

| Classification | Scenarios |
|---|---:|
| Adequate | 7,697 |
| Excess | 3,797 |
| Shortage | 2,151 |

**Automatic (1,000 runs):**

| State | Runs |
|---|---:|
| Upper risk | 632 |
| Lower risk | 252 |
| Near minimum | 55 |
| Near maximum | 46 |
| Adequate | 15 |

These distributions describe **test scenarios**, not the observed incidence of shortage or excess inventory events at the factory.

### 10.3 Sensitivity

Relative permutation importance indicated that **inventory coverage + projection horizon** accounted for **80.0%** of importance in the manual simulator and **99.1%** in the automatic simulator.

| Parameter | Manual importance | Automatic importance |
|---|---:|---:|
| Inventory coverage | 42.1% | 58.8% |
| Projection horizon | 37.9% | 40.3% |
| Consumption factor | 14.6% | Not comparably evaluated |
| Initial inventory | 3.7% | 0.9% |
| Work center | 1.3% | Less than 0.1% |
| Historical days | 0.4% | — |
| Minimum inventory mode | — | Less than 0.1% |
| Consumption option | — | Less than 0.1% |

In the manual simulator, when **horizon/coverage ≤ 0.5**, the proportion of adequate scenarios was **96.3%**; when **horizon/coverage > 2**, it was **20.6%**. The Spearman correlation between this ratio and the proportion of adequate scenarios was **−0.810**. The consumption-to-production ratio was associated with normalized inventory at **−0.784**.

In the automatic simulator, the horizon-to-coverage ratio showed a Spearman correlation of **0.949** with normalized inventory under the evaluated experimental design. The consumption option did not change the results because historical outflows were unavailable.

### 10.4 Evolution and Time to Excess Inventory

- In the manual simulator, across the 7- and 90-day horizon groups, the proportion of adequate scenarios ranged from **88.7% to 28.3%**, shortage from **4.1% to 25.8%**, and excess from **7.1% to 45.9%**.
- In the manual 90-day analysis, **1,037 of 2,260 scenarios (45.9%)** exhibited excess, with median alert times ranging from **2 to 80 days**.
- In the automatic simulator, the subset of **139 configurations** with a 90-day horizon exhibited excess in all configurations, with median times ranging from **0 to 61 days**, under zero consumption in the calculations.

**Interpretation caution:** horizon groups also differ in other configuration parameters. Therefore, aggregate comparisons between groups do not isolate a causal effect of the horizon alone.

## 11. How to Use

### 11.1 Initial Setup

1. Open https://mina-prod-trend.lovable.app/.
2. Under **API Connections**, register an authorized MES connection (name, URL, and credentials).
3. Activate the connection and confirm that synchronization indicators and WCs appear.
4. If the connection or data are unavailable, the website will show an empty state; this does not imply an absence of industrial production.

### 11.2 Production Analysis

1. Select a WC or the `All` option, when available.
2. Adjust the **observed days** and projection horizon.
3. Examine cumulative production, trend, and heatmap.
4. Interpret the inventory limit as a configured reference rather than inventory measured by the sensor.

### 11.3 Manual Simulator

1. Select the WC and number of projection days.
2. Enter **current available inventory**, **daily consumption**, and **maximum capacity**.
3. Click **Simulate Scenarios** (or the equivalent label displayed by the application).
4. Compare alternatives, classifications, and the date of the first alert.
5. If needed, select **Send Simulation** after configuring a recipient.

### 11.4 Automatic Simulator

1. Configure WC, projection horizon, initial inventory, maximum inventory, and minimum inventory.
2. Choose whether to include inventory outflows, and confirm that valid historical records are available.
3. Click **Update Projection Now** (or the equivalent label displayed by the application), or enable **Automatic Mode**.
4. Monitor the trajectory and five inventory states.
5. Enable recipients to receive notifications, subject to the application's delivery rules.

## 12. Technologies and Installation

### 12.1 Documented Technologies

Project documentation and the public dependency manifest identify the following primary components:

| Layer | Technologies |
|---|---|
| Development and deployment | Lovable |
| Web application | React 19, TypeScript, TanStack Start and Router |
| Data and queries | TanStack Query, REST API, Supabase/PostgreSQL |
| User interface | Radix UI, Tailwind CSS, Recharts |
| Validation | Zod |
| Development tools | Vite, Bun, ESLint, Prettier |
| Email | Resend / configured delivery integration |
| Version control | Git and GitHub |

Detailed dependencies and versions should always be checked in [`package.json`](https://github.com/dmax2023/mina-prod-trend2/blob/main/package.json) and the repository's lockfile.

### 12.2 Local Execution

```bash
git clone https://github.com/dmax2023/mina-prod-trend2.git
cd mina-prod-trend2
npm install
npm run dev
```

Using Bun, if available:

```bash
bun install
bun run dev
```

Project commands:

```bash
npm run build
npm run lint
npm run format
```

For full functionality, configure services and environment variables in the **appropriate environment** (Lovable Cloud, server, or local environment), without including real keys in the repository. Variable names and requirements may change between revisions; consult the configuration modules and deployment environment.

## 13. Reproducibility, Security, and Limitations

### 13.1 Reproducibility

The research documents parameters, run counts, metrics, and mathematical rules. Full independent reproduction requires the corresponding experimental scripts/results, software versions, and datasets authorized for use. **The application repository must not be assumed to contain all original industrial data or all analytical scripts**.

A minimum reproducibility package should include:

- data-source description and version information (anonymized where necessary);
- configurations for each run and sampled parameters;
- outputs from the 1,000 experiments for each simulator;
- analytical reference calculations and tolerances;
- sensitivity analysis and figure-generation code;
- access conditions, data licensing, and execution instructions.

### 13.2 Security Before Publishing

**Attention: a `.env` file is listed in the public `mina-prod-trend2` repository.** This does not prove secrets are present, but warrants immediate inspection. Do not publish actual `API_KEY`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, MES tokens, or other credentials. If any secret has been committed, **revoke/rotate the credential** and treat Git history as potentially exposed; deleting the file in the current commit alone does not remove historical versions.

Store sensitive local settings outside version control and use `.env.example` only with placeholder values. Respect the industrial partner's access and privacy policies.

### 13.3 Scientific and Operational Limitations

- The study covers **one manufacturing company and a limited set of WCs**; generalizability should be tested in other contexts.
- The inventory balance assumes constant production and consumption within the scenarios considered.
- In the evaluated case, **historical physical inventory and actual consumption/shipping time series were unavailable** for validating the automatic simulator's projections.
- The `R²`, MAE, and RMSE results presented in this README measure **agreement between the implementation and reference equations**, not forecast error against observed inventory.
- Sensitivity analysis quantifies influence within the sampled configurations and does not establish operational causality.
- The application does not perform automatic control of the physical process.
- One-second synchronization is a configured query interval, not evidence of one-second end-to-end latency for every event.
- Notification operation depends on external configuration and the system's state/deduplication rules.

## 14. Future Work, References, and License

### 14.1 Next Steps

- incorporate **real historical consumption, shipping, and inventory data**;
- assess predictive performance through **out-of-sample temporal validation** (*rolling-origin / backtesting*);
- test exogenous variables, seasonality, and nonlinear models against simple baselines;
- evaluate operation with reliable source timestamps and end-to-end latency metrics;
- expand automated tests of classification rules, limits, alerts, and deduplication;
- repeat the experiments with other manufacturers and WCs;
- release anonymized, versioned experimental materials subject to applicable authorizations.

### 14.2 Essential References

1. ISO. *ISO 23247-1:2021 — Automation systems and integration — Digital twin framework for manufacturing — Part 1: Overview and general principles.*
2. ISO. *ISO 23247-2:2021 — Automation systems and integration — Digital twin framework for manufacturing — Part 2: Reference architecture.*
3. **Data-Driven MES-Integrated Digital Twin for Inventory Projection and Scenario Analysis.** Scientific manuscript documenting the case study, both simulators, and the experimental evaluation. **Do not claim publication or acceptance before editorial confirmation.**

### 14.3 How to Cite

Once the paper has an identifiable publication record, add its final reference and, if appropriate, a `CITATION.cff` file with DOI, authors, and version. Until then, cite the repository with its URL and the revision/commit used.

### 14.4 License and Use

Check the repository for a `LICENSE` file and review its contents. **Making source code public does not automatically grant permission for reuse.** The software license and terms of use for industrial data must be explicitly defined by the responsible parties.

---

**Summary:** observe → synchronize → simulate → interpret → support decisions.  
**Documentation update:** October 26, 2026, aligned with the manuscript version and the public interface inspected on that date.  
**Scope:** research application for monitoring, simulation, and analysis; no automatic intervention in the physical process.
