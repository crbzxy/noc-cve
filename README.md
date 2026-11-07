# NOC · CVE Watch

Dashboard tipo NOC (pantalla de pared) que junta las CVEs de varias fuentes, quita duplicados por ID y las ordena por riesgo real.

| Fuente | Qué aporta | Límite sin credencial |
|---|---|---|
| **NVD (NIST)** API 2.0 | CVEs publicadas en la ventana, CVSS v4/v3.1/v2 y CWE | 5 req / 30 s (con `NVD_API_KEY`: 50) |
| **GitHub Advisories** | Advisories revisados, paquetes por ecosistema (npm, maven, pip, composer…) y GHSA sin CVE | 60 req/h (con `GITHUB_TOKEN`: 5000) |
| **CISA KEV** | CVEs explotadas activamente, fecha límite y uso en ransomware | — |
| **FIRST EPSS** | Probabilidad de explotación a 30 días | — |

**Prioridad (orden por defecto):** KEV > ransomware > EPSS > severidad > CVSS. Primero aparece lo que ya se está explotando, no solo lo que tiene CVSS alto.

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
src/
  sources/      nvd.ts · github.ts · kev.ts · epss.ts   → cada una mapea a PartialCve
  lib/          aggregate.ts (fusión por ID + riskScore) · http.ts
  hooks/        useCves.ts  (un useQuery por fuente; EPSS depende de los IDs fusionados)
  store/        filters.ts  (Zustand + persist)
  components/   KpiRow · SeverityTimeline · SourceStatus · FiltersBar · CveTable · CveDrawer
proxy.config.mjs            upstreams compartidos por Vite (dev) y server/index.mjs (prod)
```

- Las llaves de API solo viven en el proxy y nunca llegan al bundle.
- Cada fuente se consulta por separado: si una falla, las demás siguen funcionando y el panel *Estado de fuentes* muestra el error.
- **Agregar otra fuente** (OSV, JVN, MSRC, un feed interno): crea `src/sources/x.ts` que devuelva `PartialCve[]`, agrega su upstream en `proxy.config.mjs` y súmala en `useCves`.
- La severidad se muestra siempre con icono y texto, no solo con color, para que sea legible con daltonismo y a distancia.
