import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Alert, Box, Chip, Divider, Drawer, IconButton, Link, Stack, Typography } from '@mui/material'
import { useMemo } from 'react'
import { useSourcesConfig } from '../hooks/useSourcesConfig'
import { MONO } from '../theme'
import type { CveRecord } from '../types'
import { SeverityChip } from './SeverityChip'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">{label}</Typography>
      <Box>{children}</Box>
    </Box>
  )
}

export function CveDrawer({ cve, onClose }: { cve: CveRecord | null; onClose: () => void }) {
  const { config } = useSourcesConfig()
  const techLabelById = useMemo(
    () => Object.fromEntries(config.technologies.map((tech) => [tech.id, tech.label])),
    [config.technologies],
  )
  const ghsa = cve?.id.startsWith('GHSA-') ? cve.id : cve?.aliases.find((a) => a.startsWith('GHSA-'))
  return (
    <Drawer anchor="right" open={Boolean(cve)} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 520 }, p: 3 } } }}>
      {cve && (
        <Stack spacing={2}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontFamily: MONO, fontSize: 20, fontWeight: 700 }}>{cve.id}</Typography>
            <IconButton onClick={onClose} aria-label="Cerrar"><CloseIcon /></IconButton>
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <SeverityChip severity={cve.severity} size="medium" />
            {cve.cvss != null && <Chip label={`CVSS ${cve.cvss.toFixed(1)}${cve.cvssVersion ? ` (v${cve.cvssVersion})` : ''}`} />}
            {cve.epss && <Chip label={`EPSS ${(cve.epss.score * 100).toFixed(2)} % · p${(cve.epss.percentile * 100).toFixed(0)}`} />}
            {cve.status && <Chip variant="outlined" label={cve.status} />}
          </Stack>

          {cve.kev && (
            <Alert severity="error" variant="outlined">
              <strong>
                Explotada activamente (
                {cve.kev.catalog === 'vulncheck' ? 'VulnCheck KEV' : 'CISA KEV'}
                )
              </strong>
              {' '}desde {cve.kev.dateAdded}
              {cve.sources.includes('vulncheck-kev') && cve.sources.includes('kev') && (
                <> · también en el otro catálogo KEV</>
              )}
              {cve.kev.dueDate && <> · fecha límite {cve.kev.dueDate}</>}
              {cve.kev.ransomware && <> · <strong>usada en campañas de ransomware</strong></>}
              {cve.kev.requiredAction && <Typography variant="body2" sx={{ mt: 1 }}>{cve.kev.requiredAction}</Typography>}
            </Alert>
          )}

          {cve.title && <Typography variant="h6">{cve.title}</Typography>}
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{cve.description || 'Sin descripción'}</Typography>

          <Divider />

          {cve.technologies.length > 0 && (
            <Field label="Stack vigilado">
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {cve.technologies.map((techId) => (
                  <Chip key={techId} size="small" color="secondary" label={techLabelById[techId] ?? techId} />
                ))}
              </Stack>
            </Field>
          )}
          {cve.matchedLibraries.length > 0 && (
            <Field label="Librerías del inventario">
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {cve.matchedLibraries.map((library) => (
                  <Chip key={library} size="small" color="warning" label={library} sx={{ fontFamily: MONO }} />
                ))}
              </Stack>
            </Field>
          )}
          {cve.packages.length > 0 && (
            <Field label="Afecta a">
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                {cve.packages.map((p) => <Chip key={p} size="small" label={p} sx={{ fontFamily: MONO }} />)}
              </Stack>
            </Field>
          )}
          {cve.cwes.length > 0 && (
            <Field label="Debilidades">
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                {cve.cwes.map((w) => (
                  <Chip key={w} size="small" component="a" clickable target="_blank" rel="noreferrer" label={w}
                    href={`https://cwe.mitre.org/data/definitions/${w.replace('CWE-', '')}.html`} />
                ))}
              </Stack>
            </Field>
          )}
          <Field label="Fechas">
            <Typography variant="body2">Publicado: {cve.published ?? '—'}</Typography>
            <Typography variant="body2">Modificado: {cve.modified ?? '—'}</Typography>
          </Field>

          <Field label="Enlaces">
            <Stack spacing={0.5}>
              {cve.id.startsWith('CVE-') && (
                <Link href={`https://nvd.nist.gov/vuln/detail/${cve.id}`} target="_blank" rel="noreferrer">
                  NVD <OpenInNewIcon sx={{ fontSize: 12 }} />
                </Link>
              )}
              {ghsa && (
                <Link href={`https://github.com/advisories/${ghsa}`} target="_blank" rel="noreferrer">
                  GitHub Advisory {ghsa} <OpenInNewIcon sx={{ fontSize: 12 }} />
                </Link>
              )}
              {cve.references.slice(0, 12).map((r) => (
                <Link key={r} href={r} target="_blank" rel="noreferrer" variant="body2" sx={{ wordBreak: 'break-all' }}>{r}</Link>
              ))}
            </Stack>
          </Field>
        </Stack>
      )}
    </Drawer>
  )
}
