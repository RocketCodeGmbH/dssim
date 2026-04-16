# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DSSIM** (DataSpaceSIMulation Framework) — a TypeScript/Node.js framework for describing, automatically deploying, and evaluating sovereign data exchange scenarios in data spaces. Created as a Master's thesis (Michel Otto, Fraunhofer IEE / Hochschule Bremen, May 2023). It enables IT-savvy researchers to experiment with different connector technologies (IDS/DSC, Eclipse EDC), data space architectures, and data flows — without requiring deep infrastructure or connector expertise.

The `edc-connector/` subdirectory is an embedded fork of Eclipse EDC (Java/Gradle). It has its own `CLAUDE.md` with guidance specific to that codebase.

## Business Context & Motivation

European initiatives (Gaia-X, Catena-X, Mobility Dataspaces, Health-X) are building **data spaces** for sovereign, cross-organizational data exchange. As of early 2023 there were 23+ competing connector implementations, many incompatible. Experimenting with different architectures manually is costly and requires deep expertise.

**Data Space** (working definition): decentralized digital infrastructure for trustworthy, cross-organizational data sharing that preserves participant sovereignty. Data providers retain full control over usage conditions.

**Data Sovereignty**: the self-determined exercise of control over collection, storage, distribution, and processing of owned data.

### IDS Reference Architecture Model (RAM) — key components

The IDSA Reference Architecture defines these standard data space components (all relevant to what DSSIM controls and simulates):

| Component | Role |
|-----------|------|
| **Connector** | Core component enforcing data sovereignty — interfaces participant's internal systems with the data space. Enforces usage policies, logs transactions. |
| **Identity Provider / DAPS** | Manages participant identities (Dynamic Attribute Provisioning Service). |
| **Metadata Broker** | Intermediary for publishing/discovering data offers. |
| **Clearing House** | Logs all exchange transactions; enables auditing and billing. |
| **Vocabulary Provider** | Shared ontologies/metadata schemas for data annotation. |

### Connector Technologies Supported

| Technology | Description |
|------------|-------------|
| **DSC** (DataSpace Connector) | Open-source (Apache 2.0), Fraunhofer ISST / Sovity. IDS reference connector. Uses Apache Camel for data routing. |
| **EDC** (Eclipse Dataspace Connector) | Successor to DSC, Eclipse Foundation. Supports AWS, Azure, GCP, OTC. Implements DSP (DataSpace Protocol). |
| **DAPS** | Dynamic Attribute Provisioning Service — IDS identity provider (omejdn implementation). |

### Evaluation Use Case

Validated against a real Fraunhofer IEE project: **energy data-X** — live PV (photovoltaic) performance data exchange. A data provider publishes PV output measurements; a consumer uses them together with other parameters to forecast grid load. Simulations analyze how network quality (bandwidth, latency, packet loss) affects data transfer.

## Thesis Framework Architecture — Module Map

The thesis defines 6 framework modules with formal names. This table maps them to the npm packages in this repo:

| Thesis Module | npm Package | Role |
|---------------|-------------|------|
| **dssim-core** | `dssim-core` | Framework-wide interfaces, data model, utilities. Single source of truth for all type definitions. |
| **Scenario-Execution** | `dssim-scenarios` | CLI entry point, scenario descriptions, scenario configurations, assets (Grafana dashboards). |
| **Scenario-Controller** | `dssim-scenario-controller` | Central orchestrator — exposes `startConnector()`, coordinates Environment-Controller and Component-Controller. |
| **DataSpace-Component-Controller** | `dssim-ids-controller`, `dssim-edc-controller` | Facades controlling connector instances via HTTP-REST (create offers, negotiate contracts, transfer data). |
| **Environment-Controller** | `dssim-kubernetes-controller` | Manages Kubernetes deployments, services, ingress, network constraints (CPU/bandwidth/latency limits). |
| **Scenario-Monitoring** | sub-module of `dssim-kubernetes-controller` | Collects logs and metrics; Promtail + Prometheus + Loki + Grafana stack. |

Supporting libraries (OpenAPI-generated HTTP clients, published separately on npm):

| Package | Purpose |
|---------|---------|
| `dsc-lib` | DSC REST API client (generated from DSC OpenAPI spec) |
| `edc-lib` | EDC REST API client (generated from EDC OpenAPI spec) |
| `ids-broker-lib` | IDS Metadata Broker REST API client |

## Repository Layout

This is **not** a workspace — each TypeScript package is self-contained with its own `node_modules` and must be installed/built independently.

```
dssim-core/                    # Base interfaces, types, logger (Winston/Loki), utilities
dssim-scenario-controller/     # ScenarioController orchestrator — connector lifecycle management
dssim-ids-controller/          # IDS/DSC connector facade + broker control
dssim-edc-controller/          # EDC connector facade
dssim-kubernetes-controller/   # Deploys/manages connector instances on Kubernetes
dssim-scenarios/               # Main entry point — interactive CLI + 8 built-in scenarios
dsc-lib/                       # DSC Connector HTTP client (generated from OpenAPI)
edc-lib/                       # EDC Connector HTTP client (generated from OpenAPI)
ids-broker-lib/                # IDS Metadata Broker HTTP client (generated from OpenAPI)
dummyservice/                  # Minimal HTTP service used as a test data backend
edc-connector/                 # Embedded Eclipse EDC fork (Java 21 / Gradle 9.4.1)
```

## Build & Test Commands

### TypeScript Modules

All TS modules share the same script set:

```bash
npm install          # Install dependencies (run once per module)
npm run compile      # Compile TypeScript → build/
npm run lint         # Run gts lint
npm run fix          # Auto-fix style issues (gts fix)
npm run test         # Compile + run tests + lint
npm run clean        # Remove build/
```

Test frameworks vary by module: **mocha** in `dsc-lib`, `edc-lib`, `dssim-scenario-controller`, `dssim-ids-controller`; **vitest** in `dssim-edc-controller`.

To run the main application (interactive scenario selector):

```bash
cd dssim-scenarios
npm install
npm run start
```

### Java (edc-connector/)

Requires Java 21. See `edc-connector/CLAUDE.md` for full guidance.

```bash
cd edc-connector
./gradlew build                                               # Full build with tests
./gradlew build -x test                                       # Build without tests
./gradlew :module:path:test                                   # Single module tests
./gradlew :module:path:test --tests "ClassName.methodName"   # Single test
./gradlew checkstyleMain checkstyleTest                       # Lint
```

## Architecture

### Dependency Graph

```
dssim-scenarios  (CLI entry point)
  ├── dssim-core                  (foundation types, logger, utilities)
  ├── dssim-scenario-controller   (orchestration engine)
  ├── dssim-ids-controller        → dsc-lib, ids-broker-lib, dssim-core
  ├── dssim-edc-controller        → edc-lib, dssim-core
  └── dssim-kubernetes-controller → dssim-core
```

### Execution Flow

1. `dssim-scenarios/src/index.ts` loads `.env`, instantiates the 8 scenario classes, and starts `DssimCli`.
2. `DssimCli` (src/ui/cli.ts) prompts interactively: choose a scenario and a **configuration** (IDS minimal, EDC minimal, IDS+DAPS, custom controller).
3. Each configuration declares three factories:
   - `environmentControllerFactory` — creates a `KubernetesController` (or future Docker)
   - `defaultConnectorInstanceFactory` — creates `DSCInstance` or `EDCInstance` objects
   - `ConnectorControllerType` — the facade class (`DSCController`, `EDCController`, etc.)
4. The selected scenario's `run(controller: ScenarioControllerInterface)` method is called. The scenario orchestrates: deploy instances, wait for health, execute the data-sharing workflow, optionally tear down.

### Key Patterns

**Facade per connector technology**: `DSCController`, `EDCController`, `DapsController` each wrap a specific connector's HTTP API. Scenarios call generic `ScenarioControllerInterface` methods — the concrete controller handles protocol details. A single high-level operation (e.g., `createDatabaseOffer`) may fan out to 16 individual REST calls against the connector.

**Configuration-driven instantiation**: Scenarios are decoupled from connector type. Swapping IDS for EDC is a configuration selection, not a code change. Factories in `dssim-scenarios/src/configurations/` define the wiring. Each `SzenarioConfiguration` provides:
- `environmentControllerFactory` — factory for `KubernetesController`
- `defaultConnectorInstanceFactory` — factory for `DSCInstance` / `EDCInstance`
- `ConnectorControllerType` — the concrete controller class (e.g. `DSCController`)

**Generic `startConnector<I, C>()`**: The central factory method on `ScenarioController`. Returns a `Connector<I, C>` object combining both the `ConnectorInstance` (infrastructure handle) and `ConnectorController` (data-space operations handle). Using generics avoids casting and gives full type-specific API access in scenario code.

**Dependency Inversion**: All interfaces defined in `dssim-core`; implementations depend on abstractions. Dependency graph arrows always point toward `dssim-core`.

**Template Method for Kubernetes deployment**: `deployWithTemplate<T>()` defines the fixed deployment sequence: pull-secrets → secrets → config-maps → app → services → ingress. Subclasses (`DSCInstance`, `EDCInstance`, etc.) override only the steps they need to customize.

**Singleton for infrastructure access**: `KubernetesExecutor` (wraps `@kubernetes/client-node`) and `DssimLogger` are Singletons — ensuring a single control point for cluster state and consistent labelling.

**Usage Policy abstraction**: Usage policies are represented as an abstract `UsagePolicy` class with a `type` discriminator field. Subclasses (`UnrestrictedPolicy`, `TimerangeRestricted`, `NumberUsagesRestricted`, etc.) are mapped to connector-specific representations by each controller's `UsageRuleMapper`.

**Async throughout**: All deployment, health-check polling, and connector operations are `async/await`. `waitFor(predicate, timeout)` from `dssim-core` handles readiness polling with configurable backoff.

**Logger singleton**: `DssimLogger` wraps Winston with optional Loki sink. At startup logs only to console; once the Monitoring module is ready, `addLokiOutput()` adds the Loki transport and all subsequent logs flow to the central pipeline.

### Monitoring Stack

Scenario-Monitoring is implemented as a sub-module of `dssim-kubernetes-controller`:

- **Logging pipeline**: DSSIM framework modules → Winston/Loki → Promtail (sidecar) → Loki server
- **Scraping pipeline**: Prometheus scrapes Kubernetes node/pod metrics
- **Visualization**: Grafana dashboards (JSON definitions in `dssim-scenarios/assets/dashboards/`, auto-deployed at simulation start)

### Versioning

All framework npm packages use **Semantic Versioning**. When adding a new connector technology or changing the `dssim-core` interfaces, increment the **MAJOR** version across *all* modules — all deployed modules must share the same MAJOR version to be compatible.

### Environment Configuration

The framework distinguishes two configuration types:

**User/environment-specific** (`.env` — never commit to VCS): usernames, passwords, hostnames, image pull credentials. `dssim-scenarios/.env` controls:
- Kubernetes connection (`KUBECONFIG` or in-cluster)
- Image pull secrets and registry credentials
- Loki logging endpoint
- Connector credentials and namespace settings

**Scenario configuration** (TypeScript, committable): connector image tags, which `ConnectorControllerType` to use, `identityManagement` settings (DAPS endpoint/instance type). These are injected into `ScenarioController` via its constructor and can be shared with other researchers.

## TypeScript Conventions

- Target: ES2018, `module: nodenext`, strict mode enabled across all modules.
- No CommonJS — ES module imports throughout (`import`/`export`).
- `gts` (Google TypeScript Style) enforces formatting. Run `npm run fix` before committing.
- Tests compile to `build/test/` and run against compiled JS, not source directly.
