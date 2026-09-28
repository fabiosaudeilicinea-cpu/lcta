/* ============================================================================
 * PIPELINE PNCP (Node) — ingestão → desduplicação → funil → snapshot p/ Vercel
 * Uso:
 *   node scripts/run-pipeline.mjs [--dias=35] [--max=1200] [--top=40] [--out=public/data]
 * Gera: <out>/snapshot.json  (+ cópia em .vercel/output/static se existir o build)
 * ==========================================================================*/

import { mkdirSync, writeFileSync, existsSync, readdirSync, renameSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  classificarEdital, devePassarNoFunil, dedupeKey, derivarStatus,
  extrairDescritivoSeguro, orcamentoIndisponivel, normalize,
} from './lib/funil.mjs'
import { buscarPropostasAbertas, buscarItens, buscarDocumentacao, linkPncpOficial } from './lib/pncp.mjs'

const VERSAO_PIPELINE = '1.1.0'
const MODALIDADES_TECH = [4, 6] // Concorrência Eletrônica + Pregão Eletrônico
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseArgs(argv) {
  const out = { dias: 35, max: 1200, top: 40, out: path.join(__dirname, '..', 'public', 'data') }
  for (const a of argv.slice(2)) {
    const m = a.match(/^--(\w+)=(.+)$/)
    if (!m) continue
    if (m[1] === 'dias') out.dias = Number(m[2])
    if (m[1] === 'max') out.max = Number(m[2])
    if (m[1] === 'top') out.top = Number(m[2])
    if (m[1] === 'out') out.out = path.resolve(m[2])
  }
  return out
}

/** Janelas de 7 dias para respeitar o rate-limit da API pública do PNCP. */
async function varrerJanela({ dataInicial, dataFinal, modalidade, uf }, maxRegistros, prog, rotulo) {
  const coletados = []
  const passos = []
  for (let t = dataInicial.getTime(); t < dataFinal.getTime(); t += 7 * 86_400_000) {
    passos.push([new Date(t), new Date(Math.min(t + 7 * 86_400_000 - 1, dataFinal.getTime()))])
  }
  for (const [di, df] of passos) {
    for (let pagina = 1; pagina <= 10; pagina++) {
      if (coletados.length >= maxRegistros) return coletados
      prog(`${rotulo} (${uf ?? 'BR'}, ${di.toISOString().slice(0, 10)} → ${df.toISOString().slice(0, 10)}, pág. ${pagina})…`)
      const res = await buscarPropostasAbertas({ dataInicial: di, dataFinal: df, modalidade, uf, pagina, tamanhoPagina: 50 })
      if (!res || !res.data?.length) break
      coletados.push(...res.data)
      if (pagina >= (res.totalPaginas ?? 1)) break
      await sleep(400) // gentileza com a API pública
    }
  }
  return coletados
}

async function main() {
  const args = parseArgs(process.argv)
  const agora = new Date()
  const dataFinal = new Date(agora.getTime() + 120 * 86_400_000) // propostas que fecham até +120d
  const dataInicial = new Date(agora.getTime() - args.dias * 86_400_000)

  const prog = (msg) => console.log(`[pipeline ${agora.toISOString().slice(0, 16)}Z] ${msg}`)

  /* ---------- A. INGESTÃO (matriz: modalidades × páginas) ---------- */
  prog(`A. Ingestão PNCP — janela ${dataInicial.toISOString().slice(0, 10)} → ${dataFinal.toISOString().slice(0, 10)}`)
  let brutos = []
  for (const modalidade of MODALIDADES_TECH) {
    const parte = await varrerJanela({ dataInicial, dataFinal, modalidade }, args.max - brutos.length, prog, `Varredura modalidade ${modalidade}`)
    brutos = brutos.concat(parte)
    await sleep(600)
  }
  const brutosCapturados = brutos.length
  prog(`Candidatos brutos capturados: ${brutosCapturados}`)

  /* ---------- B1. DESDUPLICAÇÃO ---------- */
  const vistos = new Set()
  const unicos = []
  let duplicadosRemovidos = 0
  for (const c of brutos) {
    const k = dedupeKey(c)
    if (vistos.has(k)) { duplicadosRemovidos++; continue }
    vistos.add(k)
    unicos.push(c)
  }
  prog(`B. Desduplicação: ${unicos.length} únicos (-${duplicadosRemovidos} duplicados)`)

  /* ---------- B2. FUNIL DE CLASSIFICAÇÃO ---------- */
  const candidatos = []
  let falsosPositivos = 0
  for (const c of unicos) {
    const cls = classificarEdital(c)
    if (devePassarNoFunil(cls)) candidatos.push({ raw: c, cls })
    else falsosPositivos++
  }
  candidatos.sort((a, b) => b.cls.scoreRelevancia - a.cls.scoreRelevancia)
  prog(`Falsos positivos descartados: ${falsosPositivos} | Aprovados no funil: ${candidatos.length}`)

  /* ---------- C. ENRIQUECIMENTO DO TOPO (itens/TR + anexos) ---------- */
  const editais = []
  for (let i = 0; i < candidatos.length; i++) {
    const { raw, cls } = candidatos[i]
    let itens = undefined
    let anexos = []
    if (i < args.top && raw.numeroControlePNCP) {
      prog(`C. Enriquecendo edital ${i + 1}/${Math.min(args.top, candidatos.length)} (${raw.numeroControlePNCP})…`)
      try {
        itens = await buscarItens(raw.numeroControlePNCP)
        anexos = await buscarDocumentacao(raw.numeroControlePNCP)
      } catch { /* falha de enriquecimento não derruba o funil */ }
      await sleep(500)
    }

    const st = derivarStatus(raw, agora)
    const semOrcamento = orcamentoIndisponivel(raw.valorTotalEstimado)
    const desc = extrairDescritivoSeguro(raw.objetoCompra, itens)

    editais.push({
      ...raw,
      itens,
      anexos,
      dedupeKey: dedupeKey(raw),
      descritivo: desc.descritivo,
      descritivoFallbackOficial: desc.fallbackOficial,
      categorias: cls.categorias,
      termosMatched: cls.termosMatched,
      scoreRelevancia: cls.scoreRelevancia,
      excluidoPor: cls.excluidoPor,
      natureza: cls.natureza,
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
    })
  }

  /* ordenação final: abertos primeiro (urgência); encerrados no fim */
  editais.sort((a, b) => {
    if (a.encerrado !== b.encerrado) return a.encerrado ? 1 : -1
    if (a.encerrado && b.encerrado) return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    const da = a.diasParaEncerrar ?? 9999
    const db = b.diasParaEncerrar ?? 9999
    if (da !== db) return da - db
    return b.scoreRelevancia - a.scoreRelevancia
  })

  const snapshot = {
    meta: {
      geradoEm: agora.toISOString(),
      janelaDias: args.dias,
      brutosCapturados,
      aposFiltroQualidade: editais.filter((e) => !e.encerrado).length,
      duplicadosRemovidos,
      falsosPositivosDescartados: falsosPositivos,
      matrizBusca: MODALIDADES_TECH.map((m) => ({ termo: `modalidade-${m}`, ufs: ['BR'] })),
      fonte: 'API Pública PNCP (Lei 14.133/2021)',
      versaoPipeline: VERSAO_PIPELINE,
    },
    editais,
  }

  /* ---------- D. ESCRITA DO SNAPSHOT (atômica) ---------- */
  mkdirSync(args.out, { recursive: true })
  const destino = path.join(args.out, 'snapshot.json')
  const tmp = destino + '.tmp'
  writeFileSync(tmp, JSON.stringify(snapshot))
  renameSync(tmp, destino)
  prog(`Snapshot escrito: ${destino} (${(JSON.stringify(snapshot).length / 1024).toFixed(0)} KB, ${editais.length} editais)`)

  // prune: mantém apenas o snapshot atual na pasta de dados
  for (const f of readdirSync(args.out)) {
    if (f.startsWith('snapshot') && f !== 'snapshot.json') {
      try { unlinkSync(path.join(args.out, f)) } catch {}
    }
  }

  // Se houver saída de build da Vercel, publica também lá (deploy via prebuilt)
  const vercelStatic = path.join(__dirname, '..', '.vercel', 'output', 'static', 'data')
  if (existsSync(path.join(__dirname, '..', '.vercel'))) {
    mkdirSync(vercelStatic, { recursive: true })
    writeFileSync(path.join(vercelStatic, 'snapshot.json'), JSON.stringify(snapshot))
    prog('Snapshot copiado para .vercel/output/static/data')
  }
}

main().catch((e) => { console.error('Pipeline falhou:', e); process.exit(1) })
