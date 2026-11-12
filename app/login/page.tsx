'use client'

import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, Suspense, useState } from 'react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const next = searchParams.get('next') || '/'
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password, next }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        setError(body.error || 'No se pudo iniciar sesión')
        return
      }
      const body = await response.json() as { next?: string }
      router.replace(body.next || next)
      router.refresh()
    } catch {
      setError('Error de red al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        background: 'radial-gradient(1200px 600px at 20% -10%, #1d2a3a, transparent), radial-gradient(900px 500px at 90% 10%, #2a1d1d, transparent), #111110',
      }}
    >
      <Paper
        component="form"
        onSubmit={onSubmit}
        sx={{ width: 'min(100%, 380px)', p: 4, borderRadius: '12px' }}
      >
        <Typography variant="h6" sx={{ mb: 1 }}>Truper · NOC CVE</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Vista privada — inicia sesión para continuar
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <TextField
            label="Usuario"
            name="username"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <TextField
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
