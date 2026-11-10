import SearchIcon from '@mui/icons-material/Search'
import { Box, InputBase } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { useFilters } from '../store/filters'
import { BORDER_STRONG, MONO, SURFACE } from '../theme'

/** Búsqueda global del header; `/` o Ctrl/⌘+K enfocan el campo, Esc lo limpia. */
export function SearchBox() {
  const search = useFilters((state) => state.search)
  const setSearch = useFilters((state) => state.setSearch)
  const [q, setQ] = useState(search)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(q), 200)
    return () => clearTimeout(t)
  }, [q, setSearch])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Ctrl/⌘+K funciona incluso con el foco en otro campo; `/` solo fuera de inputs.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        return
      }
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Box
      component="label"
      sx={{
        flex: '1 1 360px',
        minWidth: 220,
        maxWidth: 640,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 1.5,
        bgcolor: SURFACE,
        border: `1px solid ${BORDER_STRONG}`,
        borderRadius: '10px',
        cursor: 'text',
        '&:focus-within': { borderColor: 'primary.main' },
      }}
    >
      <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
      <InputBase
        inputRef={inputRef}
        value={q}
        onChange={(event) => setQ(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setQ('')
            inputRef.current?.blur()
          }
        }}
        placeholder="Buscar CVE, GHSA, paquete, vendor, tecnología…"
        inputProps={{ 'aria-label': 'Buscar CVEs' }}
        sx={{ flex: 1, fontSize: 14 }}
      />
      <Box
        component="kbd"
        aria-hidden
        title="Atajos: / o Ctrl+K"
        sx={{
          fontFamily: MONO,
          fontSize: 11,
          color: 'text.secondary',
          border: `1px solid ${BORDER_STRONG}`,
          borderRadius: '6px',
          px: 0.75,
          py: 0.125,
        }}
      >
        /
      </Box>
    </Box>
  )
}
