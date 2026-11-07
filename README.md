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
=======
# cve



## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

- [ ] [Create](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#create-a-file) or [upload](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#upload-a-file) files
- [ ] [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://scm.truper.com/magento/monitor/cve.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

- [ ] [Set up project integrations](https://scm.truper.com/magento/monitor/cve/-/settings/integrations)

## Collaborate with your team

- [ ] [Invite team members and collaborators](https://docs.gitlab.com/ee/user/project/members/)
- [ ] [Create a new merge request](https://docs.gitlab.com/ee/user/project/merge_requests/creating_merge_requests.html)
- [ ] [Automatically close issues from merge requests](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically)
- [ ] [Enable merge request approvals](https://docs.gitlab.com/ee/user/project/merge_requests/approvals/)
- [ ] [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

- [ ] [Get started with GitLab CI/CD](https://docs.gitlab.com/ee/ci/quick_start/)
- [ ] [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/ee/user/application_security/sast/)
- [ ] [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/ee/topics/autodevops/requirements.html)
- [ ] [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/ee/user/clusters/agent/)
- [ ] [Set up protected environments](https://docs.gitlab.com/ee/ci/environments/protected_environments.html)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.

