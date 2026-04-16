# EDC Split Deployment Design

**Date:** 2026-04-16
**Status:** Approved

## Overview

The DSSIM framework currently deploys each EDC connector as a single Docker container bundling both the control plane and data plane. This design adds opt-in support for deploying the control plane and data plane as separate Kubernetes pods, using separate pre-built Docker images.

The existing `EDCInstance` and `EDCController` are unchanged. Split deployment is a new configuration entry in the CLI.

---

## Background

### Current Architecture

`EDCInstance` (in `dssim-kubernetes-controller`) creates:
- 1 ConfigMap, 1 Deployment, 1 Service, 1 Ingress
- All endpoints (ports 8080–8686) are served by a single pod
- `containerImages: ContainerImage[]` is an array but `deployApp()` only uses `containerImages[0]`

`EDCController` (in `dssim-edc-controller`) is constructed with a single `hostname`. `setHttpDataReceiver()` registers the data plane selector URL as `http://{hostname}:8585/control/transfer` — pointing to the same host as the management API.

### Why Split Fails Today

In a split deployment, the control plane and data plane are separate pods with separate Kubernetes service names. The control plane needs to reach the data plane at a different hostname for:
- Dispatching transfer signals: `http://{dp-host}:8585/control/transfer`
- Advertising the consumer download URL: `http://{dp-host}:8686/public/`

And the data plane needs to reach the control plane at a different hostname for:
- Token validation: `http://{cp-host}:8585/control/token` (set in data plane `config.properties`)

---

## Design

### Naming Convention

Given a base deployment name (e.g., `"provider"`):
- Control plane Kubernetes name: `provider-cp`
- Data plane Kubernetes name: `provider-dp`

`ScenarioController.startConnector("provider", ...)` passes `"provider"` as the hostname. Both `SplitEDCInstance` and `SplitEDCController` derive plane-specific names by appending `-cp` / `-dp`.

### Scope

- Backwards-compatible: `EDCInstance` and `EDCController` are untouched.
- Same cluster and namespace as existing deployments.
- Separate Docker images for each plane already exist externally.

---

## Components

### 1. `SplitEDCInstance`

**File:** `dssim-kubernetes-controller/src/EDC/SplitEDCInstance.ts`

Extends `BaseInstance`. Overrides all deploy methods to create two sets of Kubernetes resources.

**Constructor:**
```typescript
constructor(
  deploymentName: string,
  username: string,
  password: string,
  generateCpConfig: (cpHostname: string, cpEndpoints: Endpoint[]) => string,
  generateDpConfig: (dpHostname: string, cpHostname: string, dpEndpoints: Endpoint[]) => string,
  keystore: string,
  vaultFile: string,
  vaultPw: string,
  cpImage: ContainerImage,
  dpImage: ContainerImage
)
```

Passes `[cpImage, dpImage]` to `BaseInstance` so `deployPullSecrets()` handles both images without modification.

**Internal names:**
- `cpName = "${deploymentName}-cp"`
- `dpName = "${deploymentName}-dp"`

**Endpoint split:**

Control plane endpoints (ports on CP pod):

| Name | Port | Path |
|------|------|------|
| health | 8080 | /api/check |
| controller | 8181 | /api |
| ids | 8282 | /api/v1/ids |
| datamanagement | 8383 | /api/v1/data |
| control | 8585 | /control |

Data plane endpoints (ports on DP pod):

| Name | Port | Path |
|------|------|------|
| health | 8080 | /api/check |
| dataplane | 8484 | /dataplane |
| control | 8585 | /control |
| public | 8686 | /public |

Port 8585/control appears on both pods — no conflict since they are separate pods with independent network namespaces.

**Deploy sequence:**

```
deployPullSecrets()  → BaseInstance handles both images (no override needed)
deployConfigMaps()   → ConfigMap "edc-pre-config-{name}-cp"  (CP config + vault + keystore)
                     → ConfigMap "edc-pre-config-{name}-dp"  (DP config + vault + keystore)
deployApp()          → Deployment "{name}-cp"  (cpImage, cp endpoints)
                     → Deployment "{name}-dp"  (dpImage, dp endpoints)
deployServices()     → Service "{name}-cp"  (cp endpoint ports)
                     → Service "{name}-dp"  (dp endpoint ports)
deployIngress()      → Ingress host "{name}-cp"  (cp endpoint paths)
                     → Ingress host "{name}-dp"  (dp endpoint paths)
                     → sets this.hostname = "{name}-cp"
                     → sets this.healthCheckUrl = "https://{name}-cp/api/check/health"
```

**Export:** Add `SplitEDCInstance` to `dssim-kubernetes-controller/src/index.ts`.

---

### 2. `SplitEDCController`

**File:** `dssim-edc-controller/src/SplitEDCController.ts`

Extends `EDCController`. Derives plane hostnames from the base name received from `ScenarioController`.

```typescript
export class SplitEDCController extends EDCController {
  private dataplaneHostname: string;

  constructor(hostname: string, username: string, password: string, endpoints: Endpoint[]) {
    super(`${hostname}-cp`, username, password, endpoints);
    this.dataplaneHostname = `${hostname}-dp`;
  }

  async setHttpDataReceiver(url: string): Promise<void> {
    await this.connectorApi.dataplaneSelectorService.addEntry({
      id: 'http-pull-provider-dataplane',
      url: `http://${this.dataplaneHostname}:8585/control/transfer`,
      allowedSourceTypes: ['HttpData'],
      allowedDestTypes: ['HttpProxy', 'HttpData'],
      properties: {
        publicApiUrl: `http://${this.dataplaneHostname}:8686/public/`,
      },
    });
    this.httpReceiverUrl = url;  // requires httpReceiverUrl to be protected on EDCController
  }
}
```

`EDCController.connectorApi` and the management/IDS API calls all use `${hostname}-cp` — no changes needed there.

**Note:** `httpReceiverUrl` is a private field on `EDCController`. Either make it `protected`, or re-implement `transferArtifactsForAgreement` in `SplitEDCController`. Making it `protected` is the simpler change.

**Export:** Add `SplitEDCController` to `dssim-edc-controller/src/index.ts`.

---

### 3. Config Generators

**File:** `dssim-scenarios/src/configurations/splitEdcFactory.ts`

Two config generator functions replace the single `generateEdcConfig` from `edcFactory.ts`. Each generator receives only its own plane's endpoints.

**Control plane config** (`generateCpConfig(cpHostname, cpEndpoints)`):
```properties
edc.ids.id=urn:connector:{cpHostname}
ids.webhook.address=http://{cpHostname}:{idsPort}
web.http.port={controllerPort}
web.http.path={controllerPath}
web.http.management.port={managementPort}
web.http.management.path={managementPath}
web.http.ids.port={idsPort}
web.http.ids.path={idsPath}
web.http.control.port={controlPort}
web.http.control.path={controlPath}
edc.receiver.http.endpoint=http://dataservice:4000/receiver/urn:connector:provider/callback
edc.public.key.alias=public-key
edc.transfer.dataplane.token.signer.privatekey.alias=1
edc.transfer.proxy.token.signer.privatekey.alias=1
edc.transfer.proxy.token.verifier.publickey.alias=public-key
```

No `web.http.protocol.*` or `web.http.public.*` — those are data plane concerns.

**Data plane config** (`generateDpConfig(dpHostname, cpHostname, dpEndpoints)`):
```properties
web.http.protocol.port={dataplanePort}
web.http.protocol.path={dataplanePath}
web.http.public.port={publicPort}
web.http.public.path={publicPath}
web.http.control.port={controlPort}
web.http.control.path={controlPath}
edc.dataplane.token.validation.endpoint=http://{cpHostname}:{controlPort}/control/token
```

The `edc.dataplane.token.validation.endpoint` points to the **control plane** hostname — this is the cross-plane config coupling.

**Factory function:**
```typescript
export const splitEdcFactory = (deploymentName: string) =>
  new SplitEDCInstance(
    deploymentName,
    'username',
    'password',
    generateCpConfig,
    generateDpConfig,
    loadEdcKeyStoreFile(),
    loadEdcVaultFile(),
    '123456',
    { image: '<cp-image-url>', pullSecret },  // replace with actual control plane image URL
    { image: '<dp-image-url>', pullSecret }   // replace with actual data plane image URL
  );
```

---

### 4. New Scenario Configuration Entry

**File:** `dssim-scenarios/src/configurations/index.ts`

Add to the `configurations` array:

```typescript
{
  name: 'EDC split deployment',
  environmentControllerFactory: async () =>
    await KubernetesController.createInstance(false, undefined),
  defaultConnectorInstanceFactory: splitEdcFactory,
  ConnectorControllerType: SplitEDCController,
  identityManagement: undefined,
},
```

---

## Data Flow at Runtime

```
1. ScenarioController.startConnector("provider", ...)
   → splitEdcFactory("provider") → SplitEDCInstance("provider")
   → deploys pod "provider-cp"  (control plane)
   → deploys pod "provider-dp"  (data plane)
   → waits until "https://provider-cp/api/check/health" → 200

2. new SplitEDCController("provider", ...)
   → management API: https://provider-cp/api/v1/data
   → control API:    https://provider-cp/control

3. SplitEDCController.setHttpDataReceiver(callbackUrl)
   → registers data plane selector on provider-cp management API:
     url:          "http://provider-dp:8585/control/transfer"
     publicApiUrl: "http://provider-dp:8686/public/"

4. Transfer execution:
   control plane → "http://provider-dp:8585/control/transfer"   (Kubernetes DNS, intra-cluster)
   data plane validates token → "http://provider-cp:8585/control/token"  (from DP config.properties)
   consumer downloads → "http://provider-dp:8686/public/"
```

---

## Files Changed

| Action | File |
|--------|------|
| New | `dssim-kubernetes-controller/src/EDC/SplitEDCInstance.ts` |
| New | `dssim-edc-controller/src/SplitEDCController.ts` |
| New | `dssim-scenarios/src/configurations/splitEdcFactory.ts` |
| Modified | `dssim-kubernetes-controller/src/index.ts` — export `SplitEDCInstance` |
| Modified | `dssim-edc-controller/src/index.ts` — export `SplitEDCController` |
| Modified | `dssim-edc-controller/src/EDCController.ts` — `httpReceiverUrl` → `protected` |
| Modified | `dssim-scenarios/src/configurations/index.ts` — add split configuration entry |

---

## Error Handling

- **Partial deployment failure:** If data plane deployment fails after control plane succeeds, `KubernetesController.tearDown()` cleans up all namespace resources — same recovery path as today.
- **Data plane readiness:** `KubernetesExecutor.deployApp()` already waits for `readyReplicas > 0` before returning, so both pods are running before the scenario proceeds. The HTTP health check on `provider-cp` provides an additional application-level readiness signal.
- **No automated tests:** Consistent with the rest of the framework; validated by running the new scenario configuration end-to-end.
