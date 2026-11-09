import { getHealth, getSnapshot, refreshCorpus } from './store.mjs'

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload))
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

/**
 * Maneja /api/corpus, /api/corpus/health, /api/corpus/refresh.
 * @returns {boolean} true si la ruta fue atendida
 */
export function handleCorpusRequest(req, res) {
  const url = req.url?.split('?')[0] ?? ''
  const method = (req.method ?? 'GET').toUpperCase()

  if (url === '/api/corpus/health' && method === 'GET') {
    sendJson(res, 200, getHealth())
    return true
  }

  if (url === '/api/corpus/refresh' && method === 'POST') {
    refreshCorpus(true)
      .then((snapshot) => {
        if (!snapshot) {
          sendJson(res, 503, { error: getHealth().error ?? 'Corpus no disponible' })
          return
        }
        sendJson(res, 200, snapshot)
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        sendJson(res, 500, { error: message })
      })
    return true
  }

  if (url === '/api/corpus' && method === 'GET') {
    const snapshot = getSnapshot()
    if (snapshot) {
      sendJson(res, 200, snapshot)
      return true
    }
    // Primera carga: espera la ingesta en curso o dispara una.
    refreshCorpus(false)
      .then((ready) => {
        if (!ready) {
          sendJson(res, 503, {
            error: getHealth().error ?? 'Corpus aún no listo',
            health: getHealth(),
          })
          return
        }
        sendJson(res, 200, ready)
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        sendJson(res, 500, { error: message })
      })
    return true
  }

  return false
}
