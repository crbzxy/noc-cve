import { Box, Paper, Stack, Typography } from '@mui/material'
import { useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { TechnologyConfig } from '../config/sources.schema'
import { buildTechRanking, type TechRankItem } from '../lib/techRanking'
import { SEVERITY_COLOR, SEVERITY_LABEL, SURFACE } from '../theme'
import type { CveRecord } from '../types'

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

function toBarRows(items: TechRankItem[]) {
  return items.map((item) => ({
    name: item.label.length > 16 ? `${item.label.slice(0, 15)}…` : item.label,
    Críticas: item.critical,
    Altas: item.high,
    KEV: item.kev,
  }))
}

function RankingChart({ title, items }: { title: string; items: TechRankItem[] }) {
  const data = toBarRows(items)
  const chartHeight = Math.max(160, items.length * 28)

  return (
    <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Sin catálogo en esta categoría.</Typography>
      ) : (
        <Box sx={{ width: '100%', height: chartHeight, minHeight: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 2, right: 8, bottom: 0, left: 0 }}
              barCategoryGap={6}
              barGap={1}
            >
              <CartesianGrid horizontal={false} stroke="rgba(240,239,236,0.07)" />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: '#c3c2b7', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={96}
                tick={{ fill: '#c3c2b7', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <Tooltip
                contentStyle={{ background: SURFACE, border: '1px solid rgba(240,239,236,0.12)' }}
                labelStyle={{ color: '#f0efec' }}
                formatter={(value, name) => [value, name]}
              />
              <Bar dataKey="Críticas" stackId="sev" fill={SEVERITY_COLOR.CRITICAL} barSize={10} isAnimationActive={false} />
              <Bar dataKey="Altas" stackId="sev" fill={SEVERITY_COLOR.HIGH} barSize={10} isAnimationActive={false} />
              <Bar dataKey="KEV" stackId="sev" fill={SEVERITY_COLOR.MEDIUM} barSize={10} radius={[0, 2, 2, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  )
}

export function TechRelationsGraph({
  rows,
  technologies,
}: {
  rows: CveRecord[]
  technologies: TechnologyConfig[]
}) {
  const ranking = useMemo(() => buildTechRanking(rows, technologies), [rows, technologies])
  const hasCatalog = ranking.languages.length > 0 || ranking.frameworks.length > 0

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Ranking lenguajes y frameworks
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }} aria-label="Leyenda">
          <LegendSwatch color={SEVERITY_COLOR.CRITICAL} label={SEVERITY_LABEL.CRITICAL} />
          <LegendSwatch color={SEVERITY_COLOR.HIGH} label={SEVERITY_LABEL.HIGH} />
          <LegendSwatch color={SEVERITY_COLOR.MEDIUM} label="KEV" />
        </Stack>
      </Stack>

      {!hasCatalog ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', color: 'text.secondary', py: 4 }}>
          Configura category language/framework en sources.json.
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            flex: 1,
            minHeight: 0,
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            alignItems: 'start',
          }}
        >
          <RankingChart title="Lenguajes" items={ranking.languages} />
          <RankingChart title="Frameworks" items={ranking.frameworks} />
        </Box>
      )}
    </Paper>
  )
}
