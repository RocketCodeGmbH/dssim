# DSSIM — DataSpace Simulation Framework

A TypeScript/Node.js framework for describing, automatically deploying, and evaluating sovereign data exchange scenarios in [data spaces](https://internationaldataspaces.org/). Originally created as a Master's thesis at Fraunhofer IEE / Hochschule Bremen (Michel Otto, 2023).

## What it does

DSSIM lets researchers spin up realistic data space scenarios in a Kubernetes cluster without needing deep connector or infrastructure expertise. You describe a scenario in TypeScript — which connectors to deploy, what data to offer, what usage policies to apply — and the framework handles deployment, execution, monitoring, and teardown automatically.

Supported connector technologies: **DataSpace Connector (DSC)** and **Eclipse Dataspace Connector (EDC)**.

## Repository Structure

This is the parent repository. Each subfolder is a git submodule:

| Submodule | Description |
|-----------|-------------|
| `dssim-core` | Core interfaces, data model, logger, utilities |
| `dssim-scenarios` | CLI entry point + built-in scenario descriptions |
| `dssim-scenario-controller` | Central orchestrator — coordinates deployment and execution |
| `dssim-ids-controller` | IDS/DSC connector facade + broker control |
| `dssim-edc-controller` | EDC connector facade |
| `dssim-kubernetes-controller` | Kubernetes environment controller + monitoring stack |
| `dsc-lib` | DSC HTTP client (OpenAPI-generated) |
| `edc-lib` | EDC HTTP client (OpenAPI-generated) |
| `ids-broker-lib` | IDS Metadata Broker HTTP client (OpenAPI-generated) |
| `edc-connector` | Embedded Eclipse EDC fork (Java 21 / Gradle) |
| `dummyservice` | Minimal HTTP backend used in scenarios as a test data provider |

## Getting Started

### Prerequisites

- Git ≥ 2.13
- Node.js ≥ 18
- Access to a Kubernetes cluster (local or remote)

### Clone — including all submodules

```bash
git clone --recurse-submodules https://github.com/RocketCodeGmbH/dssim.git
```

If you already cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

### Pull latest changes (parent + all submodules)

```bash
# Update the parent and all submodules to their pinned commits:
git pull
git submodule update --recursive

# Or in one command:
git pull --recurse-submodules
```

### Update all submodules to their latest remote commit

```bash
git submodule update --remote --merge
```

This pulls the latest `main` branch of every submodule and updates the pinned references. Commit the result in the parent repo afterwards.

### Run the interactive scenario selector

```bash
cd dssim-scenarios
cp .env.example .env      # fill in your cluster credentials
npm install
npm run start
```

## Development Workflow

Each submodule is an independent git repository. Work inside it as you normally would:

```bash
cd dssim-core
git checkout -b my-feature
# ... make changes ...
git commit -m "feat: ..."
git push origin my-feature
```

After merging changes in a submodule, update the parent's pinned reference:

```bash
cd ..
git add dssim-core
git commit -m "bump dssim-core"
git push
```

## Further Reading

- Thesis (German/English abstract): `20230502_Masterarbeit_Michel_Otto.pdf`
- Agent/developer context: `CLAUDE.md`
