# nx-utils

NX plugin workspace for [EldenCore](https://elden-core.fr). Contains reusable NX executors and generators that power the deployment toolchain of the `vesta` monorepo.

## Packages

| Package | Version | Description |
|---|---|---|
| [`@elden-core/nx-utils`](packages/nx-utils) | 0.1.0 | Docker & Kubernetes executors/generators |

---

## `@elden-core/nx-utils`

### Installation (in a consuming monorepo)

```sh
npm install --save-dev @elden-core/nx-utils --registry https://npm.elden-core.fr
```

---

### Executor — `docker-build`

Builds a Docker image for any NX project using its `src/docker/Dockerfile`. The workspace root is always the build context, so Dockerfiles can reference `dist/apps/{project}/` directly.

**project.json example**

```json
{
  "targets": {
    "docker-build": {
      "executor": "@elden-core/nx-utils:docker-build",
      "dependsOn": ["build"],
      "options": {
        "registry": "registry.elden-core.fr",
        "imageName": "my-api",
        "tag": "latest"
      }
    }
  }
}
```

**Options**

| Option | Type | Default | Description |
|---|---|---|---|
| `registry` | `string` | — | Docker registry host |
| `imageName` | `string` | project name | Image name |
| `tag` | `string` | `latest` | Image tag |
| `dockerfile` | `string` | `{projectRoot}/src/docker/Dockerfile` | Path to Dockerfile (workspace-relative) |
| `context` | `string` | `.` | Build context (workspace-relative) |
| `buildArgs` | `object` | — | Key/value `--build-arg` entries |
| `labels` | `object` | — | Key/value `--label` entries |
| `platform` | `string` | — | Target platform, e.g. `linux/amd64` |
| `push` | `boolean` | `false` | Push image after a successful build |

**Usage**

```sh
# Build only
nx docker-build my-api

# Build and push
nx docker-build my-api --push
```

---

### Generator — `setup-docker`

Scaffolds `src/docker/Dockerfile` inside a project and wires the `docker-build` executor target automatically.

```sh
nx g @elden-core/nx-utils:setup-docker \
  --project=my-api \
  --appType=node \
  --port=3000 \
  --registry=registry.elden-core.fr
```

**Options**

| Option | Type | Default | Description |
|---|---|---|---|
| `project` | `string` | — | NX project name (**required**) |
| `appType` | `node \| nextjs \| nginx` | `node` | Selects the Dockerfile template |
| `port` | `number` | `3000` (`80` for nginx) | Exposed port |
| `registry` | `string` | — | Pre-fills the `docker-build` target's registry option |

**Generated files**

```
{projectRoot}/
  src/docker/
    Dockerfile          ← template for chosen appType
    nginx.conf          ← only for nginx appType
.dockerignore           ← created at workspace root if absent
```

**App type templates**

| `appType` | Base image | Expects NX output at |
|---|---|---|
| `node` | `node:24-alpine` | `dist/apps/{project}/` |
| `nextjs` | `node:24-alpine` | `apps/{project}/.next/standalone/` |
| `nginx` | `nginx:1.27-alpine` | `dist/apps/{project}/` |

> **Note:** Build the project before running docker-build:
> `nx build my-api && nx docker-build my-api`

---

### Generator — `setup-kube`

Scaffolds `src/kube/` Kubernetes manifests (Deployment, Service, optional Ingress) inside a project. The generated YAML files are plain manifests — commit them and let your GitOps pipeline (ArgoCD) apply them.

```sh
nx g @elden-core/nx-utils:setup-kube \
  --project=my-api \
  --namespace=production \
  --registry=registry.elden-core.fr \
  --ingressHost=my-api.elden-core.fr \
  --withTls
```

**Options**

| Option | Type | Default | Description |
|---|---|---|---|
| `project` | `string` | — | NX project name (**required**) |
| `namespace` | `string` | — | Kubernetes namespace (**required**) |
| `registry` | `string` | — | Docker registry host (**required**) |
| `imageName` | `string` | project name | Image name in the Deployment |
| `port` | `number` | `3000` | Container port |
| `replicas` | `number` | `1` | Initial replica count |
| `withIngress` | `boolean` | `true` | Generate `ingress.yaml` |
| `ingressHost` | `string` | `{project}.elden-core.fr` | Ingress hostname |
| `withTls` | `boolean` | `false` | Add cert-manager TLS annotations |

**Generated files**

```
{projectRoot}/
  src/kube/
    deployment.yaml
    service.yaml
    ingress.yaml    ← omitted when withIngress=false
```

---

## Development

### Prerequisites

- Node.js 24+
- npm 11+

### Setup

```sh
npm install
```

### Available targets

```sh
# Type-check
npx nx typecheck nx-utils

# Build (output: dist/packages/nx-utils/)
npx nx build nx-utils

# Test with coverage
npx nx test nx-utils

# Publish to npm.elden-core.fr
npx nx publish nx-utils
```

### Adding a new executor or generator

1. Create `src/executors/{name}/executor.ts` + `schema.json` + `schema.d.ts`
2. Register it in `executors.json` (or `generators.json` for generators)
3. Export it from `src/index.ts`
4. Add tests in `src/executors/{name}/executor.spec.ts`

---

## CI/CD

The GitHub Actions pipeline at `.github/workflows/ci.yml` runs on every push and pull request:

| Job | Trigger | Steps |
|---|---|---|
| `ci` | push + PR | format-check → lint → typecheck → build → test |
| `publish` | push to `main` only | build → `npm publish dist/packages/nx-utils` |

Publishing requires a `NPM_TOKEN` secret configured in the repository settings.
