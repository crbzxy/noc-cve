# NOC · CVE Watch

Dashboard tipo NOC (pantalla de pared) multi-tecnología: junta CVEs de varias fuentes, las etiqueta según el stack vigilado, quita duplicados por ID y las ordena por riesgo real (más crítico → menos crítico).

## Fuente de verdad: `config/sources.json`

Un solo JSON controla:

| Sección | Qué define |
|---|---|
| `sources` | Fuentes de datos: `id`, `label`, `enabled`, `role`, **`baseUrl`**, `path`, `proxyPrefix`, `authEnv` |
| `technologies` | Lenguajes/tecnologías a vigilar (Magento, Java, Docker, Nginx, Redis, DBs, HTTP…) y sus keywords |
| `defaults` | `stackOnly`, orden por riesgo |

El proxy (Vite + `server/index.mjs`) y el frontend leen ese archivo. Tras editarlo:

```bash
npm run sync:sources   # copia a public/config/sources.json
```

(`predev` / `prebuild` ya lo hacen solos.)

**Secretos:** `NVD_API_KEY` y `GITHUB_TOKEN` siguen en `.env`, no en el JSON.

**Red / QA:** el servidor debe poder salir por HTTPS a los `baseUrl` del JSON (sobre todo `https://api.first.org` para EPSS). Si el firewall bloquea FIRST, `/api/epss` responde **502** con un JSON que indica el host bloqueado; NVD/KEV pueden seguir en línea.

### Añadir o apagar una fuente

1. Edita la entrada en `sources` (`enabled: false` para apagarla).
2. Ajusta `baseUrl` + `path` si el upstream cambia.
3. Reinicia `npm run dev` / redespliega.

### Añadir una tecnología / lenguaje

Agrega un objeto en `technologies`:

```json
{ "id": "nodejs", "label": "Node.js", "keywords": ["node.js", "nodejs", "npm"] }
```

Con **Solo stack** activo (default), la tabla solo muestra CVEs que coincidan con esos keywords.

| Fuente | Qué aporta | Límite sin credencial |
|---|---|---|
| **NVD (NIST)** API 2.0 | CVEs publicadas en la ventana, CVSS v4/v3.1/v2 y CWE | 5 req / 30 s (con `NVD_API_KEY`: 50) |
| **GitHub Advisories** | Advisories revisados, paquetes por ecosistema y GHSA sin CVE | 60 req/h (con `GITHUB_TOKEN`: 5000) |
| **CISA KEV** | CVEs explotadas activamente, fecha límite y ransomware | — |
| **FIRST EPSS** | Probabilidad de explotación a 30 días | — |

**Prioridad (orden por defecto):** KEV > ransomware > EPSS > match de stack > severidad > CVSS.

## Uso

```bash
npm i
cp .env.example .env        # opcional: NVD_API_KEY, GITHUB_TOKEN
npm run dev                 # http://localhost:5173
```

Producción (Node ≥ 20, sin dependencias extra):

```bash
npm run build && npm start  # http://localhost:8080 — sirve dist/ y hace de proxy con caché de 60 s
```

Modo demo, sin internet o si la red corporativa bloquea alguna fuente:

```bash
npm run mock                # terminal 1: simula las 4 APIs en :4010
npm run dev:mock            # terminal 2
```

## Arquitectura

```
config/sources.json         SSOT: fuentes (URL base) + tecnologías + defaults
public/config/sources.json  copia servida al browser (sync)
proxy.config.mjs            arma upstreams desde el JSON
src/
  config/       schema + loader
  sources/      nvd · github · kev · epss → PartialCve
  lib/          aggregate · matchTechnologies · http
  hooks/        useCves · useSourcesConfig
  store/        filters (Zustand + persist)
  components/   KpiRow · SeverityTimeline · SourceStatus · FiltersBar · CveTable · CveDrawer
```

- Las llaves de API solo viven en el proxy y nunca llegan al bundle.
- Cada fuente se consulta por separado: si una falla, las demás siguen y el panel *Estado de fuentes* muestra el error (tooltip con `baseUrl`).
- La severidad se muestra con icono y texto, no solo con color.
