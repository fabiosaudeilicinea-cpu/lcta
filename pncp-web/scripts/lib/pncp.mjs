/* ============================================================================
 * CLIENTE PNCP (Node) — API Pública de Consultas (Lei 14.133/2021)
 * https://pncp.gov.br/api/consulta/swagger-ui/index.html
 * Inclui retry/backoff: a API pública possui rate-limiting agressivo.
 * ==========================================================================*/

export const PNCP_BASE = 'https://pncp.gov.br/api/consulta'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Formata Date → yyyyMMdd exigido pela API. */
export function ymd(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

/** Componentes do numeroControlePNCP para os endpoints /itens e /documentacao. */
export function componentes(idControle) {
  // Formato oficial: <CNPJ>-<m>-<sequencial 6 dígitos>/<ano>
  const m = String(idControle).match(/^(\d{14})-\d-0*(\d+)\/(\d{4})$/)
  if (!m) return null
  return { cnpj: m[1], seq: Number(m[2]), ano: m[3] }
}

async function fetchJson(url, { attempts = 4, timeoutMs = 25_000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'EditalTech/1.0 (monitoramento editais TI)' },
        signal: ctrl.signal,
      })
      if (res.status === 204) return null // sem conteúdo na janela — não é erro
      if (res.status === 429 || res.status >= 500) throw new Error(`http ${res.status}`)
      if (!res.ok) return null
      const text = await res.text()
      if (!text) return null
      return JSON.parse(text)
    } catch {
      const back = 800 * 2 ** i + Math.random() * 400 // backoff exponencial + jitter
      await sleep(back)
    } finally {
      clearTimeout(t)
    }
  }
  return null
}

/**
 * Endpoint A — Contratações com recebimento de propostas em ABERTO (coração do funil):
 * GET /v1/contratacoes/proposta?dataInicial&dataFinal&codigoModalidadeContratacao[&uf][&municipioNome]&pagina&tamanhoPagina
 */
export async function buscarPropostasAbertas({ dataInicial, dataFinal, modalidade, uf, municipioNome, pagina = 1, tamanhoPagina = 50 }) {
  let url =
    `${PNCP_BASE}/v1/contratacoes/proposta` +
    `?dataInicial=${ymd(dataInicial)}&dataFinal=${ymd(dataFinal)}` +
    `&codigoModalidadeContratacao=${modalidade}&pagina=${pagina}&tamanhoPagina=${tamanhoPagina}`
  if (uf) url += `&uf=${encodeURIComponent(uf)}`
  if (municipioNome) url += `&municipioNome=${encodeURIComponent(municipioNome)}`
  return fetchJson(url)
}

/**
 * Endpoint B — Contratações por data de PUBLICAÇÃO (varredura ampla/histórico):
 * GET /v1/contratacoes/publicacao?dataInicial&dataFinal&codigoModalidadeContratacao[&uf]&pagina&tamanhoPagina
 */
export async function buscarPorPublicacao({ dataInicial, dataFinal, modalidade, uf, municipioNome, pagina = 1, tamanhoPagina = 50 }) {
  let url =
    `${PNCP_BASE}/v1/contratacoes/publicacao` +
    `?dataInicial=${ymd(dataInicial)}&dataFinal=${ymd(dataFinal)}` +
    `&codigoModalidadeContratacao=${modalidade}&pagina=${pagina}&tamanhoPagina=${tamanhoPagina}`
  if (uf) url += `&uf=${encodeURIComponent(uf)}`
  if (municipioNome) url += `&municipioNome=${encodeURIComponent(municipioNome)}`
  return fetchJson(url)
}

/**
 * Endpoint C — Itens/Termo de Referência estruturado:
 * GET /v1/contratacoes/itens/{cnpj}/{ano}/{sequencial}
 */
export async function buscarItens(idControle) {
  const c = componentes(idControle)
  if (!c) return []
  const res = await fetchJson(`${PNCP_BASE}/v1/contratacoes/itens/${c.cnpj}/${c.ano}/${c.seq}`, { attempts: 2 })
  if (!res) return []
  return Array.isArray(res) ? res : (res.data ?? [])
}

/**
 * Endpoint D — Documentação técnica/anexos do edital:
 * GET /v1/contratacoes/documentacao/{cnpj}/{ano}/{sequencial}
 */
export async function buscarDocumentacao(idControle) {
  const c = componentes(idControle)
  if (!c) return []
  const res = await fetchJson(`${PNCP_BASE}/v1/contratacoes/documentacao/${c.cnpj}/${c.ano}/${c.seq}`, { attempts: 2 })
  if (!res) return []
  return Array.isArray(res) ? res : (res.data ?? [])
}

/** URL pública do edital no portal PNCP (deep-link oficial). */
export function linkPncpOficial(c) {
  const ano = c.anoCompra ?? new Date(c.dataPublicacaoPncp).getFullYear()
  const seq = String(c.sequencialCompra ?? '').padStart(6, '0')
  const cnpj = c.orgaoEntidade?.cnpj ?? ''
  return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`
}

export const MODALIDADES = [
  { id: 1, nome: 'Leilão - Eletrônico' },
  { id: 2, nome: 'Diálogo Competitivo' },
  { id: 3, nome: 'Concurso' },
  { id: 4, nome: 'Concorrência - Eletrônica' },
  { id: 5, nome: 'Concorrência - Presencial' },
  { id: 6, nome: 'Pregão - Eletrônico' },
  { id: 7, nome: 'Pregão - Presencial' },
]
