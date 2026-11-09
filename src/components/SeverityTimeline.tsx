import { Box, Paper, Stack, Typography } from '@mui/material'
import { eachDayOfInterval, format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { CHART_CURSOR, CHART_GRID, CHART_TICK, SEVERITY_COLOR, SEVERITY_LABEL, SURFACE } from '../theme'
import { SEVERITIES, type CveRecord, type Severity } from '../types'
import { SEVERITY_ICON } from './SeverityChip'

type Row = { day: string; label: string } & Record<Severity, number>

// Orden de apilado: lo más grave abajo (pegado a la base) para leerlo primero
const STACK: Severity[] = [...SEVERITIES]

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as Row
  const total = SEVERITIES.reduce((s, k) => s + row[k], 0)
  return (
    <Paper sx={{ p: 1.5, minWidth: 170 }}>
      <Typography variant="subtitle2">{row.label}</Typography>
      {SEVERITIES.filter((s) => row[s] > 0).map((s) => (
        <Stack key={s} direction="row" spacing={2} sx={{ justifyContent: "space-between" }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: SEVERITY_COLOR[s] }} />
            <Typography variant="body2">{SEVERITY_LABEL[s]}</Typography>
          </Stack>
          <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{row[s]}</Typography>
        </Stack>
      ))}
      <Typography variant="caption" color="text.secondary">Total: {total}</Typography>
    </Paper>
  )
}

export function SeverityTimeline({ rows, days }: { rows: CveRecord[]; days: number }) {
  const data = useMemo<Row[]>(() => {
    const range = eachDayOfInterval({ start: subDays(new Date(), days - 1), end: new Date() })
    const byDay = new Map<string, Row>(
      range.map((d) => {
        const key = format(d, 'yyyy-MM-dd')
        return [key, { day: key, label: format(d, "EEE d 'de' MMM", { locale: es }), CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 }]
      }),
    )
    for (const r of rows) {
      const key = r.published?.slice(0, 10)
      const row = key && byDay.get(key)
      if (row) row[r.severity]++
    }
    return [...byDay.values()]
  }, [rows, days])

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 0.5, flexShrink: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Publicaciones por día y severidad</Typography>
        <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
          {SEVERITIES.map((s) => {
            const Icon = SEVERITY_ICON[s]
            return (
              <Stack key={s} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <Icon sx={{ fontSize: 13, color: SEVERITY_COLOR[s] }} />
                <Typography variant="caption" color="text.secondary">{SEVERITY_LABEL[s]}</Typography>
              </Stack>
            )
          })}
        </Stack>
      </Stack>
      <Box sx={{ width: '100%', flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke={CHART_GRID} />
            <XAxis
              dataKey="day"
              tickFormatter={(d: string) => format(new Date(`${d}T12:00:00`), days > 14 ? 'd/M' : 'EEE d', { locale: es })}
              tick={{ fill: CHART_TICK, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis allowDecimals={false} tick={{ fill: CHART_TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={ChartTooltip} cursor={{ fill: CHART_CURSOR }} />
            {STACK.map((s, i) => (
              <Bar
                key={s}
                dataKey={s}
                stackId="sev"
                fill={SEVERITY_COLOR[s]}
                stroke={SURFACE}
                strokeWidth={2}
                radius={i === STACK.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  )
}
