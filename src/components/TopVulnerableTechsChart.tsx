import { Box, Paper, Stack, Typography } from '@mui/material'
import { useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { TechnologyConfig } from '../config/sources.schema'
import { buildTopVulnerableTechs, TOP_VULNERABLE_TECHS, type TechRankItem } from '../lib/techRanking'
import { CHART_CURSOR, CHART_GRID, CHART_TICK, KEV_COLOR, SEVERITY_COLOR, SEVERITY_LABEL, SURFACE, TEXT_PRIMARY } from '../theme'
import type { CveRecord } from '../types'

const Y_AXIS_WIDTH = 110

type ChartRow = {
  name: string
  fullLabel: string
  rank: number
  Críticas: number
  Altas: number
  KEV: number
  total: number
  cves: number
}

const SERIES = [
  { key: 'Críticas' as const, color: SEVERITY_COLOR.CRITICAL, label: SEVERITY_LABEL.CRITICAL },
  { key: 'Altas' as const, color: SEVERITY_COLOR.HIGH, label: SEVERITY_LABEL.HIGH },
  { key: 'KEV' as const, color: KEV_COLOR, label: 'KEV' },
]

function shortLabel(label: string, max = 12): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label
}

function toChartRows(items: TechRankItem[]): ChartRow[] {
  return items.map((item, index) => ({
    name: `${index + 1}. ${shortLabel(item.label)}`,
    fullLabel: item.label,
    rank: index + 1,
    Críticas: item.critical,
    Altas: item.high,
    KEV: item.kev,
    total: item.critical + item.high + item.kev,
    cves: item.count,
  }))
}

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as ChartRow
  return (
    <Paper sx={{ p: 1.5, minWidth: 180 }}>
      <Typography variant="subtitle2">
        #{row.rank} · {row.fullLabel}
      </Typography>
      {SERIES.filter((series) => row[series.key] > 0).map((series) => (
        <Stack key={series.key} direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: series.color }} />
            <Typography variant="body2">{series.label}</Typography>
          </Stack>
          <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {row[series.key]}
          </Typography>
        </Stack>
      ))}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        Señal de riesgo: {row.total} · CVEs en stack: {row.cves}
      </Typography>
    </Paper>
  )
}

function TotalLabel(props: {
  x?: number | string
  y?: number | string
  width?: number | string
  value?: unknown
}) {
  const x = Number(props.x ?? 0)
  const y = Number(props.y ?? 0)
  const width = Number(props.width ?? 0)
  const raw = props.value
  const value = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : 0
  if (!value) return <g />
  return (
    <text
      x={x + width + 4}
      y={y + 3}
      fill={CHART_TICK}
      fontSize={10}
      fontWeight={600}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {value}
    </text>
  )
}

export function TopVulnerableTechsChart({
  rows,
  technologies,
}: {
  rows: CveRecord[]
  technologies: TechnologyConfig[]
}) {
  const ranking = useMemo(
    () => buildTopVulnerableTechs(rows, technologies, TOP_VULNERABLE_TECHS),
    [rows, technologies],
  )
  const data = useMemo(() => toChartRows(ranking), [ranking])

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 0.5, flexShrink: 0 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Top {TOP_VULNERABLE_TECHS} tecnologías vulnerables
        </Typography>
        <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }} aria-label="Leyenda">
          {SERIES.map((series) => (
            <Stack key={series.key} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: series.color, flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary">{series.label}</Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>

      {ranking.length === 0 ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
          Sin tecnologías con señal de riesgo en los filtros actuales.
        </Box>
      ) : (
        <Box sx={{ width: '100%', flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 28, bottom: -4, left: 0 }}
              barCategoryGap="12%"
            >
              <CartesianGrid horizontal={false} stroke={CHART_GRID} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: CHART_TICK, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={Y_AXIS_WIDTH}
                tick={{ fill: TEXT_PRIMARY, fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <Tooltip content={ChartTooltip} cursor={{ fill: CHART_CURSOR }} />
              {SERIES.map((series, index) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  stackId="risk"
                  fill={series.color}
                  stroke={SURFACE}
                  strokeWidth={1}
                  barSize={12}
                  radius={index === SERIES.length - 1 ? [0, 3, 3, 0] : 0}
                  isAnimationActive={false}
                >
                  {index === SERIES.length - 1 && (
                    <LabelList dataKey="total" content={TotalLabel} />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  )
}
