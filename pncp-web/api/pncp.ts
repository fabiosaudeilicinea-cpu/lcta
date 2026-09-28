/* ============================================================================
 * Serverless Function (Vercel) — Proxy same-origin para a API Pública do PNCP.
 * - Resolve CORS no navegador
 * - Adiciona cache de borda (s-maxage) e proteção básica de parâmetros
 * GET /api/pncp?pagina=1&tamanhoPagina=50&dataInicial=20260901&...
 * ==========================================================================*/

const UPSTREAM = 'https://pncp.gov.br/api/consulta/publicacao'

const ALLOWED_PARAMS = new Set([
  'pagina',
  'tamanhoPagina',
  'dataInicial',
  'dataFinal',
  'codigoModalidadeContratacao',
  'uf',
  'codigoMunicipioIbge',
])

export default async function handler(req: { query?: Record<string, string | string[]>; method?: string }, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(204).end()
  }

  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(req.query ?? {})) {
    if (!ALLOWED_PARAMS.has(k)) continue
    q.set(k, Array.isArray(v) ? v[0] : v)
  }
  if (!q.has('pagina')) q.set('pagina', '1')
  if (!q.has('tamanhoPagina')) q.set('tamanhoPagina', '50')

  try {
    const upstream = await fetch(`${UPSTREAM}?${q.toString()}`, {
      headers: { Accept: 'application/json' },
    })
    if (upstream.status === 204) return res.status(204).end()
    const text = await upstream.text()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1200')
    return res.status(upstream.status).send(text)
  } catch (err) {
    return res.status(502).json({ erro: 'Falha ao consultar API PNCP', detalhe: String(err) })
  }
}
