/* ============================================================================
 * Pipeline de ingestão PNCP (roda no browser e/ou via Node — scripts/run-pipeline.mjs)
 * Funil: captura → enriquecimento (itens/anexos) → desduplicação →
 *        classificação (natureza + falsos positivos) → snapshot p/ UI
 * ==========================================================================*/

import { classificarEdital, devePassarNoFunil, dedupeKey, derivarStatus, extrairDescritivoSeguro, orcamentoIndisponivel } from './funil'
import { buscarDocumentacao, buscarItens, coletarCandidatos, linkPncpOficial } from './pncp'
import type { Edital, ItemCompra, PncpCompraRaw, Snapshot, SnapshotMeta } from './types'

export const VERSAO_PIPELINE = '1.0.0'
const MODALIDADES_TECH = [4, 6] // Concorrência Eletrônica + Pregão Eletrônico

/** Registro cru + possíveis itens embutidos (o PNCP pode retornar `itens` inline). */
type RawComItens = PncpCompraRaw & { itens?: unknown }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Extrai itens embutidos (se vierem como objeto não tipado do JSON da API). */
function itensInline(raw: PncpCompraRaw & { itens?: unknown }): ItemCompra[] | undefined {
  return Array.isArray(raw.itens) ? (raw.itens as ItemCompra[]) : undefined
}

/** Enriquece um registro cru em um registro limpo do modelo `Edital`. */
export async function processarRegistro(
  rawInput: PncpCompraRaw & { itens?: unknown },
  opts: { enriquecer: boolean; agora?: Date },
): Promise<{ edital?: Edital; duplicado: boolean; descartadoFalsoPositivo: boolean }> {
  // normaliza itens inline vindos do JSON (unknown → ItemCompra[])
  const raw: RawComItens & { itens?: ItemCompra[] } = { ...rawInput, itens: itensInline(rawInput) }
  let itens: ItemCompra[] | undefined
  let anexos: Edital['anexos'] = []

  if (opts.enriquecer && raw.numeroControlePNCP) {
    try {
      itens = await buscarItens(raw.numeroControlePNCP, raw)
      anexos = await buscarDocumentacao(raw.numeroControlePNCP)
    } catch {
      /* falha de enriquecimento não derruba o funil — cai na nomenclatura oficial */
    }
  } else {
    // usa itens inline quando presentes, sem custo de chamada extra
    itens = raw.itens
  }

  const cls = classificarEdital({ ...raw, itens })
  if (!devePassarNoFunil(cls)) {
    return { duplicado: false, descartadoFalsoPositivo: true }
  }

  const st = derivarStatus(raw, opts.agora ?? new Date())
  const semOrcamento = orcamentoIndisponivel(raw.valorTotalEstimado)
  const desc = extrairDescritivoSeguro(raw.objetoCompra, itens)

  const edital: Edital = {
    ...(raw as PncpCompraRaw),
    itens,
    anexos,
    dedupeKey: dedupeKey(raw),
    descritivo: desc.descritivo,
    descritivoFallbackOficial: desc.fallbackOficial,
    categorias: cls.categorias,
    termosMatched: cls.termosMatched,
    scoreRelevancia: cls.scoreRelevancia,
    orcamentoIndisponivel: semOrcamento,
    status: st.status,
    encerrado: st.encerrado,
    diasParaEncerrar: st.diasParaEncerrar,
    uf: raw.unidadeOrgao?.ufSigla ?? '',
    municipio: raw.unidadeOrgao?.municipioNome ?? '',
    esfera: raw.orgaoEntidade?.esferaId ?? '',
    valorReferencia: semOrcamento ? null : Number(raw.valorTotalEstimado),
    publishedAt: raw.dataPublicacaoPncp,
    linkPncp: linkPncpOficial(raw),
  }

  return { edital, duplicado: false, descartadoFalsoPositivo: false }
}

export interface ExecutarPipelineResult {
  snapshot: Snapshot
}

/**
 * Executa o funil completo contra a API pública do PNCP.
 * @param janelaDiasBack   dias para trás na varredura de publicações
 * @param maxRegistros     teto de segurança de candidatos brutos
 * @param onProgress       callback de progresso (UI "Atualizar")
 */
export async function executarPipeline(
  opts: {
    janelaDiasBack?: number
    maxRegistros?: number
    enriquecerTopN?: number
    onProgress?: (msg: string, pct: number) => void
    fetcher?: typeof fetch
  } = {},
): Promise<ExecutarPipelineResult> {
  const janelaDiasBack = opts.janelaDiasBack ?? 35
  const maxRegistros = opts.maxRegistros ?? 1200
  const enriquecerTopN = opts.enriquecerTopN ?? 40
  const prog = opts.onProgress ?? (() => {})

  const agora = new Date()
  const dataFinal = new Date(agora.getTime() + 90 * 86_400_000)
  const dataInicial = new Date(agora.getTime() - janelaDiasBack * 86_400_000)

  // ---------- A. INGESTÃO (matriz: modalidades × páginas) ----------
  prog('Consultando API pública do PNCP…', 5)
  const brutos = (await coletarCandidatos({
    dataInicial,
    dataFinal,
    modalidades: MODALIDADES_TECH,
    maxRegistros,
    onProgress: prog,
  })) as RawComItens[]

  const brutosCapturados = brutos.length

  // ---------- B1. DESDUPLICAÇÃO ----------
  prog('Desduplicando registros…', 45)
  const vistos = new Set<string>()
  const unicos: RawComItens[] = []
  let duplicadosRemovidos = 0
  for (const c of brutos) {
    const k = dedupeKey(c)
    if (vistos.has(k)) {
      duplicadosRemovidos++
      continue
    }
    vistos.add(k)
    unicos.push(c)
  }

  // ---------- B2. CLASSIFICAÇÃO RÁPIDA (sem enriquecimento) ----------
  prog('Classificando natureza e filtrando falsos positivos…', 55)
  const passariam: PncpCompraRaw[] = []
  let falsosPositivos = 0
  for (const c of unicos) {
    const cls = classificarEdital({ ...c, itens: itensInline(c) })
    if (devePassarNoFunil(cls)) passariam.push(c)
    else falsosPositivos++
  }

  // ordena por score para enriquecer apenas o topo (economia de chamadas)
  passariam.sort((a, b) => {
    const sa = classificarEdital({ ...a, itens: itensInline(a) }).scoreRelevancia
    const sb = classificarEdital({ ...b, itens: itensInline(b) }).scoreRelevancia
    return sb - sa
  })

  // ---------- C. ENRIQUECIMENTO DO TOPO (itens/TR + anexos) ----------
  const editais: Edital[] = []
  let i = 0
  for (const c of passariam) {
    const enriquecer = i < enriquecerTopN
    prog(`Processando edital ${i + 1}/${passariam.length}${enriquecer ? ' (com TR)' : ''}…`, 55 + Math.min(40, (i / Math.max(1, passariam.length)) * 40))
    const out = await processarRegistro(c, { enriquecer, agora })
    if (out.edital) editais.push(out.edital)
    else falsosPositivos++
    if (enriquecer) await sleep(120)
    i++
  }

  // ordenação final: abertos primeiro (urgência), encerrados no fim
  editais.sort((a, b) => {
    if (a.encerrado !== b.encerrado) return a.encerrado ? 1 : -1
    if (a.encerrado && b.encerrado) return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    const da = a.diasParaEncerrar ?? 9999
    const db = b.diasParaEncerrar ?? 9999
    if (da !== db) return da - db
    return b.scoreRelevancia - a.scoreRelevancia
  })

  const meta: SnapshotMeta = {
    geradoEm: agora.toISOString(),
    janelaDias: janelaDiasBack,
    brutosCapturados,
    aposFiltroQualidade: editais.filter((e) => !e.encerrado).length,
    duplicadosRemovidos,
    falsosPositivosDescartados: falsosPositivos,
    matrizBusca: [],
    fonte: 'API Pública PNCP (Lei 14.133/2021)',
    versaoPipeline: VERSAO_PIPELINE,
  }

  prog('Concluído.', 100)
  return { snapshot: { meta, editais } }
}
