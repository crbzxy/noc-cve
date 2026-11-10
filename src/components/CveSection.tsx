import { Chip } from '@mui/material'
import { lazy, Suspense, useState } from 'react'
import type { CveRecord } from '../types'
import { CveTable } from './CveTable'
import { ExpandableModule } from './ExpandableModule'

const CveDrawer = lazy(async () => {
  const module = await import('./CveDrawer')
  return { default: module.CveDrawer }
})

export function CveSection({
  rows,
  loading,
  open,
  onToggle,
  selectedLibrary,
  onClearLibrary,
}: {
  rows: CveRecord[]
  loading: boolean
  open: boolean
  onToggle: () => void
  selectedLibrary: string | null
  onClearLibrary: () => void
}) {
  const [selected, setSelected] = useState<CveRecord | null>(null)

  return (
    <>
      <ExpandableModule
        id="noc-cve-table-panel"
        title="CVEs"
        count={loading ? undefined : rows.length}
        open={open}
        onToggle={onToggle}
        defaultHeight={320}
        trailing={selectedLibrary ? (
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            label={selectedLibrary}
            onDelete={(event) => {
              event.stopPropagation()
              onClearLibrary()
            }}
            onClick={(event) => event.stopPropagation()}
          />
        ) : undefined}
      >
        <CveTable
          rows={rows}
          onSelect={setSelected}
          selectedId={selected?.id}
          loading={loading}
          embedded
        />
      </ExpandableModule>

      <Suspense fallback={null}>
        {selected ? (
          <CveDrawer cve={selected} onClose={() => setSelected(null)} />
        ) : null}
      </Suspense>
    </>
  )
}
