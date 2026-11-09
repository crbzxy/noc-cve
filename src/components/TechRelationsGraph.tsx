import { Box, Paper, Stack, Typography } from '@mui/material'
import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { TechnologyConfig } from '../config/sources.schema'
import { buildTechTopology } from '../lib/techTopology'
import { SEVERITY_COLOR, SEVERITY_LABEL, SURFACE } from '../theme'
import type { CveRecord } from '../types'

function hubFill(heat: number): string {
  if (heat >= 0.66) return SEVERITY_COLOR.CRITICAL
  if (heat >= 0.33) return SEVERITY_COLOR.HIGH
  return '#3987e5'
}

function leafFill(heat: number): string {
  if (heat >= 0.66) return SEVERITY_COLOR.CRITICAL
  if (heat >= 0.33) return SEVERITY_COLOR.HIGH
  if (heat > 0) return '#4a4a46'
  return '#3a3a37'
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }} title={label}>
      <Box
        aria-label={label}
        sx={{
          width: 12,
          height: 12,
          borderRadius: '2px',
          bgcolor: color,
          flexShrink: 0,
        }}
      />
    </Stack>
  )
}

export function TechRelationsGraph({
  rows,
  technologies,
}: {
  rows: CveRecord[]
  technologies: TechnologyConfig[]
}) {
  const topology = useMemo(() => buildTechTopology(rows, technologies), [rows, technologies])
  const [hover, setHover] = useState<string | null>(null)
  const pos = useMemo(() => new Map(topology.nodes.map((n) => [n.id, n])), [topology.nodes])

  const criticalBars = useMemo(
    () =>
      [...topology.nodes]
        .filter((n) => n.critical > 0 || n.high > 0 || n.kev > 0)
        .sort((a, b) => b.critical - a.critical || b.high - a.high || b.kev - a.kev)
        .slice(0, 12)
        .map((n) => ({
          name: n.label.length > 14 ? `${n.label.slice(0, 13)}…` : n.label,
          Críticas: n.critical,
          Altas: n.high,
          KEV: n.kev,
        })),
    [topology.nodes],
  )

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Topología de tecnologías
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }} aria-label="Leyenda de criticidad">
          <LegendSwatch color={SEVERITY_COLOR.CRITICAL} label={SEVERITY_LABEL.CRITICAL} />
          <LegendSwatch color={SEVERITY_COLOR.HIGH} label={SEVERITY_LABEL.HIGH} />
          <LegendSwatch color={SEVERITY_COLOR.MEDIUM} label="KEV / media" />
          <LegendSwatch color="#3987e5" label="Hub" />
          <LegendSwatch color="#3a3a37" label="Sin calor" />
        </Stack>
      </Stack>

      {topology.nodes.length === 0 ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', color: 'text.secondary', py: 4 }}>
          Sin datos de stack para graficar.
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            flex: 1,
            minHeight: 0,
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1.35fr) minmax(200px, 0.9fr)' },
            alignItems: 'stretch',
          }}
        >
          <Box sx={{ width: '100%', height: { xs: 220, sm: '100%' }, minHeight: 200 }}>
            <svg
              viewBox={`0 0 ${topology.width} ${topology.height}`}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Topología de relaciones tecnológicas"
            >
              <defs>
                <filter id="node-glow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {topology.edges.map((edge) => {
                const a = pos.get(edge.source)
                const b = pos.get(edge.target)
                if (!a || !b) return null
                const active = hover === edge.source || hover === edge.target
                const hot = edge.heat >= 0.45
                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={hot ? SEVERITY_COLOR.CRITICAL : '#3987e5'}
                    strokeOpacity={active ? 1 : hot ? 0.85 : 0.5}
                    strokeWidth={a.role === 'hub' && b.role === 'hub' ? 2.4 : 1.5}
                  />
                )
              })}

              {topology.nodes.map((node) => {
                const active = hover === node.id
                const isHub = node.role === 'hub'
                const w = isHub ? 48 : 26
                const h = isHub ? 26 : 26
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    onMouseEnter={() => setHover(node.id)}
                    onMouseLeave={() => setHover(null)}
                    filter={node.heat >= 0.66 ? 'url(#node-glow)' : undefined}
                  >
                    <title>
                      {`${node.label}: ${node.count} CVE · ${node.critical} críticas · ${node.high} altas · ${node.kev} KEV`}
                    </title>
                    <rect
                      x={-w / 2}
                      y={-h / 2}
                      width={w}
                      height={h}
                      rx={isHub ? 4 : 3}
                      fill={isHub ? hubFill(node.heat) : leafFill(node.heat)}
                      stroke={active ? '#f0efec' : 'rgba(240,239,236,0.35)'}
                      strokeWidth={active || node.heat >= 0.33 ? 2 : 1}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize={isHub ? 11 : 9}
                      fontWeight={700}
                    >
                      {node.critical > 0 ? node.critical : node.count || '·'}
                    </text>
                    <text
                      y={h / 2 + 11}
                      textAnchor="middle"
                      fill="#e8e7e2"
                      fontSize={10}
                      fontWeight={isHub ? 700 : 500}
                    >
                      {node.label.length > (isHub ? 12 : 9)
                        ? `${node.label.slice(0, isHub ? 11 : 8)}…`
                        : node.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          </Box>

          <Box sx={{ minHeight: 200, display: 'flex', flexDirection: 'column' }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Ranking</Typography>
              <LegendSwatch color={SEVERITY_COLOR.CRITICAL} label={SEVERITY_LABEL.CRITICAL} />
              <LegendSwatch color={SEVERITY_COLOR.HIGH} label={SEVERITY_LABEL.HIGH} />
              <LegendSwatch color={SEVERITY_COLOR.MEDIUM} label="KEV" />
            </Stack>
            {criticalBars.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Sin datos críticos.</Typography>
            ) : (
              <Box sx={{ flex: 1, minHeight: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={criticalBars}
                    layout="vertical"
                    margin={{ top: 2, right: 6, bottom: 0, left: 0 }}
                    barCategoryGap={4}
                    barGap={1}
                  >
                    <CartesianGrid horizontal={false} stroke="rgba(240,239,236,0.07)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: '#c3c2b7', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={78}
                      tick={{ fill: '#c3c2b7', fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={{ background: SURFACE, border: '1px solid rgba(240,239,236,0.12)' }}
                      labelStyle={{ color: '#f0efec' }}
                    />
                    <Bar dataKey="Críticas" stackId="sev" fill={SEVERITY_COLOR.CRITICAL} barSize={8} isAnimationActive={false} />
                    <Bar dataKey="Altas" stackId="sev" fill={SEVERITY_COLOR.HIGH} barSize={8} isAnimationActive={false} />
                    <Bar dataKey="KEV" stackId="sev" fill={SEVERITY_COLOR.MEDIUM} barSize={8} radius={[0, 2, 2, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Paper>
  )
}
