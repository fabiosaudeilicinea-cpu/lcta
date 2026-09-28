/* ============================================================================
 * Cliente PNCP para o NAVEGADOR.
 * Em produção (Vercel) as chamadas passam pela Serverless Function /api/pncp
 * (proxy same-origin → evita CORS e esconde o upstream). Em dev, o proxy do
 * Vite faz o mesmo papel em /api/pncp.
 * ==========================================================================*/

import type { EditalAnexo, ItemCompra, PncpCompraRaw } from './types'

const PROXY = '/api/pncp'

async function getJson<T>(path: string, timeoutMs = 25_000): Promise<T | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${PROXY}${path}`, { headers: { Accept: 'application/json' }, signal: ctrl.signal })
    if (res.status === 204) return null
    if (!res.ok) return null
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

interface PageResponse<T> {
  data: T[]
  totalRegistros: number
  totalPaginas: number
  numeroPagina: number
  paginasRestantes: number
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

/** Componentes do numeroControlePNCP → {cnpj}/{ano}/{seq} */
export function componentes(idControle: string): { cnpj: string; ano: string; seq: number } | null {
  const m = String(idControle).match(/^(\d{14})-\d-0*(\d+)\/(\d{4})$/)
  if (!m) return null
  return { cnpj: m[1], ano: m[3], seq: Number(m[2]) }
}

/** Endpoint A — propostas em aberto (coração do funil ao vivo). */
export async function buscarPropostasAbertas(params: {
  dataInicial: Date
  dataFinal: Date
  modalidade: number
  uf?: string
  pagina?: number
  tamanhoPagina?: number
}): Promise<PageResponse<PncpCompraRaw> | null> {
  const q = new URLSearchParams({
    acao: 'proposta',
    dataInicial: ymd(params.dataInicial),
    dataFinal: ymd(params.dataFinal),
    codigoModalidadeContratacao: String(params.modalidade),
    pagina: String(params.pagina ?? 1),
    tamanhoPagina: String(params.tamanhoPagina ?? 50),
  })
  if (params.uf) q.set('uf', params.uf)
  return getJson<PageResponse<PncpCompraRaw>>(`?${q.toString()}`)
}

/** Endpoint C — itens/TR estruturado. */
export async function buscarItens(numeroControlePNCP: string): Promise<ItemCompra[]> {
  const c = componentes(numeroControlePNCP)
  if (!c) return []
  const res = await getJson<{ data?: ItemCompra[] } | ItemCompra[]>(`?acao=itens&id=${encodeURIComponent(c.cnpj + '/' + c.ano + '/' + c.seq)}`)
  if (!res) return []
  return Array.isArray(res) ? res : (res.data ?? [])
}

/** Endpoint D — documentação/anexos. */
export async function buscarDocumentacao(numeroControlePNCP: string): Promise<EditalAnexo[]> {
  const c = componentes(numeroControlePNCP)
  if (!c) return []
  const res = await getJson<{ data?: EditalAnexo[] } | EditalAnexo[]>(`?acao=documentacao&id=${encodeURIComponent(c.cnpj + '/' + c.ano + '/' + c.seq)}`)
  if (!res) return []
  return Array.isArray(res) ? res : (res.data ?? [])
}

/** URL pública do edital no portal PNCP (deep-link oficial). */
export function linkPncpOficial(c: PncpCompraRaw): string {
  const ano = c.anoCompra ?? new Date(c.dataPublicacaoPncp).getFullYear()
  const seq = String(c.sequencialCompra ?? '').padStart(6, '0')
  const cnpj = c.orgaoEntidade?.cnpj ?? ''
  return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`
}
