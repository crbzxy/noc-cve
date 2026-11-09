import { Typography } from '@mui/material'
import { useEffect, useState } from 'react'

/** Reloj aislado: evita re-renderizar todo el dashboard cada segundo. */
export function HeaderClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <Typography sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>
      {now.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'medium' })}
    </Typography>
  )
}
