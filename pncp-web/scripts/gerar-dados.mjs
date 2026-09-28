/* ============================================================================
 * Gerador de dataset REALISTA (fallback offline) — estrutura idêntica ao
 * snapshot do pipeline PNCP. Objetos modelados em redações típicas de editais
 * TI reais da Lei 14.133/2021, com datas relativas a hoje. Inclui casos que
 * o funil DEVE descartar (falsos positivos) para validar as métricas.
 * Uso: node scripts/gerar-dados.mjs [--out=public/data]
 * ==========================================================================*/
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { classificarEdital, devePassarNoFunil, dedupeKey, derivarStatus, extrairDescritivoSeguro, orcamentoIndisponivel } from './lib/funil.mjs'
import { linkPncpOficial } from './lib/pncp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const agora = new Date()
const dt = (offsetDias, hora = 9, min = 0) => {
  const x = new Date(agora.getTime() + offsetDias * 86_400_000)
  x.setHours(hora, min, 0, 0)
  return x.toISOString().slice(0, 19)
}

const EN = [
  { cnpj: '08959673000180', razao: 'CAMARA DOS DEPUTADOS', poderId: 'L', esferaId: 'F', uf: 'DF', mun: 'Brasilia' },
  { cnpj: '10869904000110', razao: 'SECRETARIA DE ESTADO DA FAZENDA', poderId: 'E', esferaId: 'E', uf: 'RJ', mun: 'Rio de Janeiro' },
  { cnpj: '45132495000140', razao: 'MUNICIPIO DE LIMEIRA', poderId: 'E', esferaId: 'M', uf: 'SP', mun: 'Limeira' },
  { cnpj: '75869057000106', razao: 'MUNICIPIO DE CURITIBA', poderId: 'E', esferaId: 'M', uf: 'PR', mun: 'Curitiba' },
  { cnpj: '05440246000193', razao: 'DEPARTAMENTO ESTADUAL DE TRANSITO - DETRAN/RS', poderId: 'E', esferaId: 'E', uf: 'RS', mun: 'Porto Alegre' },
  { cnpj: '07954480000179', razao: 'MUNICIPIO DE GOIANIA', poderId: 'E', esferaId: 'M', uf: 'GO', mun: 'Goiania' },
  { cnpj: '12345608000160', razao: 'UNIVERSIDADE FEDERAL DE MINAS GERAIS', poderId: 'E', esferaId: 'F', uf: 'MG', mun: 'Belo Horizonte' },
  { cnpj: '09367279000157', razao: 'COMPANHIA DE SANEAMENTO DE PERNAMBUCO', poderId: 'E', esferaId: 'E', uf: 'PE', mun: 'Recife' },
  { cnpj: '16891068000167', razao: 'INSTITUTO DE PREVIDENCIA DOS SERVIDORES DO CEARA', poderId: 'E', esferaId: 'M', uf: 'CE', mun: 'Fortaleza' },
  { cnpj: '83294894000167', razao: 'EMPRESA DE PROCESSAMENTO DE DADOS DO MUNICIPIO', poderId: 'E', esferaId: 'M', uf: 'SC', mun: 'Florianopolis' },
]

/* [enteIdx, objeto, valor, abertura(-/+ dias), encerramento(+dias), situacaoId, modalidade, itens?] */
const CASOS = [
  // ---- DEV WEB / SOFTWARE (devem passar) ----
  [0, 'Contratacao de empresa especializada para desenvolvimento de software web de gestao de processos legislativos, incluindo criacao de portal do cidadao, APIs de integracao e aplicativo mobile, sob demanda, com garantia de evolucao continua.', 4_820_000, -12, 21, 1, 4, ['Desenvolvimento de sistema web responsivo (front-end React e back-end .NET) com modulo de tramitacao de documentos', 'Portal de transparencia com acessibilidade e-LBR e busca full-text', 'Integracao via API REST com sistemas legados (SEI e folha de pagamento)', 'Aplicativo mobile nativo Android/iOS para consulta de proposituras']],
  [1, 'Contratacao de servicos continuados de fabrica de software para manutencao evolutiva e desenvolvimento de novos modulos no portal de servicos digitais da SEFAZ, em regime de dedizacao de equipe remota.', 2_940_000, -8, 14, 1, 6],
  [2, 'Registro de precos para contratacao de solucao de desenvolvimento de aplicacao web e mobile para agendamento de servicos municipais, com hospedagem em nuvem e suporte nivel 3 remoto.', 890_000, -5, 7, 1, 6],
  [3, 'Contratacao de empresa de tecnologia para criacao de portal corporativo e reformulacao do site institucional da prefeitura, com CMS licenciado, layout adaptavel e otimizacao SEO.', 312_500, -3, 4, 1, 4],
  [4, 'Servicos de desenvolvimento back-end de microsservicos e gateway de aplicacoes para plataforma digital de emissao de carteiras, incluindo interfaces de programacao (API) e migracao de dados.', 1_780_000, -20, 30, 1, 4],
  [5, 'Contratacao de solucao tecnologica tipo Software as a Service (SaaS) com servicos de desenvolvimento de personalizacao, integracao de sistemas e sustentacao do portal de compras do municipio.', 1_150_000, -15, 18, 1, 6],
  [6, 'Desenvolvimento de plataforma digital educacional com criacao de sistema de matricula on-line, chatbot para atendimento automatizado e painel de indicadores (dashboard BI) para a reitoria.', 3_400_000, -9, 11, 1, 4],
  [7, 'Contratacao de servicos de transformacao digital: desenvolvimento web do novo portal do assinante, e-commerce de faturas e aplicativo mobile para acompanhamento de consumo de agua.', 2_100_000, -6, 9, 1, 6],
  [8, 'Servicos especializados de programacao de sistemas e customizacao de sistema de previdencia, abrangendo modulo web de simulacao de aposentadoria e integracao com APIs do gov.br.', 640_000, -2, 2, 1, 6],
  [9, 'Contratacao de devops e containerizacao para implantacao de sistema informatizado de gestao tributaria em ambiente cloud, com pipelines de entrega continua.', 980_000, -18, 26, 1, 4],
  [0, 'Desenvolvimento de assistente virtual (chatbot) com inteligencia artificial para atendimento ao cidadao, integrado ao portal da transparencia e a web service de consulta de leis.', 720_000, -4, 6, 1, 4],
  [2, 'Servicos de business intelligence e visualizacao de dados para painel de indicadores da saude municipal, com coleta automatizada via API e publicacao em web dashboard.', 415_000, -10, 16, 1, 6],
  [3, 'Implantacao de sistema informatizado de gestao de frota com aplicativo web, QR code e integracao de sistemas com a contabilidade municipal.', 560_000, -7, 12, 1, 6],
  [1, 'Contratacao de testes de invasao (pen test) e seguranca da informacao na nova plataforma digital de arrecadacao, com relatorio tecnico e plano de correcao.', 285_000, -14, 24, 1, 4],
  [4, 'Desenvolvimento de loja virtual (e-commerce) para comercializacao de produtos do artesanato local, com gateway de pagamentos e app mobile', 198_000, -1, 1, 1, 6],
  // ---- CASOS LIMITE / SINALIZACOES ----
  [5, 'Contratacao de solucao de gestao documental eletronica (desenvolvimento e implantacao de sistema web) - ORCAMENTO SIGILOSO NOS TERMOS DA LEI', null, -11, 19, 1, 4],
  [6, 'Servicos de hospedagem de site e manutencao corretiva pontual do portal institucional da UFPI, sem alocacao presencial de equipe.', 84_000, -25, 0, 4, 6], // ja encerrado (situacao homologada? usa-los como encerrado por data)
  [7, 'Credenciamento de fabrica de software para fornecimento de horas de desenvolvimento front-end sob demanda (valor estimado zerado - registro de precos).', 0, -3, 8, 1, 3],
  // ---- FALSOS POSITIVOS (devem ser DESCARTADOS pelo funil) ----
  [8, 'Aquisicao de equipamentos de informatica: computadores desktop, monitores LED, impressoras e nobreaks para os laboratorios de informatica das escolas municipais.', 1_230_000, -5, 10, 1, 6],
  [9, 'Contratacao de empresa para fornecimento e instalacao de cabo de rede categoria 6, patch cord e bobina de cabo UTP para estruturacao da rede logica predial.', 450_000, -8, 15, 1, 4],
  [0, 'Servico de manutencao preventiva e corretiva de ar-condicionado tipo split e placa eletronica de nobreak dos servidores do CPD.', 180_000, -2, 5, 1, 6],
  [1, 'Aquisicao de licenca de software antivírus e renovacao de licencas Microsoft Office 365 para os postos de trabalho da secretaria.', 920_000, -9, 17, 1, 6],
  [2, 'Contratacao de empresa de engenharia para projeto executivo de infraestrutura fisica e construcao da nova sede administrativa do municipio.', 8_400_000, -12, 25, 1, 4],
  [3, 'Locacao de maquinas e servico de apoio operacional com alocação de mao de obra presencial continuada: digitacao, arquivo e atendimento no balcao.', 2_300_000, -6, 13, 1, 6],
  [4, 'Curso de capacitacao em informatica basica e Excel para servidores efetivos do municipio.', 96_000, -4, 8, 1, 6],
  [5, 'Contratacao de servico de vigilancia patrimonial armada e portaria eletronica com monitoramento por cameras.', 3_100_000, -10, 20, 1, 4],
  // duplicata exata do caso 0 (mesmo numeroControlePNCP gerado abaixo) -> desduplicacao
  [0, 'Contratacao de empresa especializada para desenvolvimento de software web de gestao de processos legislativos, incluindo criacao de portal do cidadao, APIs de integracao e aplicativo mobile, sob demanda, com garantia de evolucao continua.', 4_820_000, -12, 21, 1, 4],
]

const contadorPorEnte = new Map()

function paraRaw([ei, objeto, valor, abOff, enOff, situacaoId, modalidadeId, itens], idx) {
  const e = EN[ei]
  const ano = agora.getFullYear()
  // sequencial por ente: republicações do MESMO objeto (multi-portal) colidem
  // no numeroControlePNCP e são capturadas pela desduplicação — como na vida real.
  const n = (contadorPorEnte.get(e.cnpj) ?? 0) + 1
  contadorPorEnte.set(e.cnpj, n)
  const seq = 100 + n
  return {
    numeroControlePNCP: `${e.cnpj}-1-${String(seq).padStart(6, '0')}/${ano}`,
    orgaoEntidade: { cnpj: e.cnpj, razaoSocial: e.razao, poderId: e.poderId, esferaId: e.esferaId },
    unidadeOrgao: { ufSigla: e.uf, ufNome: e.uf, municipioNome: e.mun, codigoUnidade: String(100000 + idx) },
    objetoCompra: objeto,
    informacaoComplementar: '',
    modalidadeId,
    modalidadeNome: modalidadeId === 4 ? 'Concorrencia - Eletronica' : modalidadeId === 6 ? 'Pregao - Eletronico' : 'Concurso',
    situacaoCompraId: situacaoId,
    situacaoCompraNome: situacaoId === 1 ? 'Divulgada no PNCP' : 'Encerrada - Homologada',
    dataPublicacaoPncp: dt(abOff, 8),
    dataAberturaProposta: dt(abOff + 1, 9),
    dataEncerramentoProposta: dt(enOff, 9, 30),
    valorTotalEstimado: valor,
    srp: false,
    tipoInstrumentoConvocatorioNome: 'Edital',
    amparoLegal: { nome: 'Lei 14.133/2021, Art. 28, I' },
    processo: String(idx + 1).padStart(5, '0'),
    anoCompra: ano,
    sequencialCompra: seq,
    itens: (itens ?? []).map((descricaoItem, k) => ({ sequencial: k + 1, descricaoItem, quantidade: 1, valorTotalItem: valor ? Math.round(valor / itens.length) : null })),
  }
}

const raws = CASOS.map(paraRaw)
const vistos = new Set()
const editais = []
let duplicados = 0, falsosPositivos = 0
for (const raw of raws) {
  const k = dedupeKey(raw)
  if (vistos.has(k)) { duplicados++; continue }
  vistos.add(k)
  const cls = classificarEdital(raw)
  if (!devePassarNoFunil(cls)) { falsosPositivos++; continue }
  const st = derivarStatus(raw, agora)
  const semOrc = orcamentoIndisponivel(raw.valorTotalEstimado)
  const desc = extrairDescritivoSeguro(raw.objetoCompra, raw.itens)
  editais.push({
    ...raw,
    dedupeKey: k,
    descritivo: desc.descritivo,
    descritivoFallbackOficial: desc.fallbackOficial,
    categorias: cls.categorias,
    termosMatched: cls.termosMatched,
    scoreRelevancia: cls.scoreRelevancia,
    excluidoPor: cls.excluidoPor,
    natureza: cls.natureza,
    orcamentoIndisponivel: semOrc,
    status: st.status,
    encerrado: st.encerrado,
    diasParaEncerrar: st.diasParaEncerrar,
    uf: raw.unidadeOrgao.ufSigla,
    municipio: raw.unidadeOrgao.municipioNome,
    esfera: raw.orgaoEntidade.esferaId,
    valorReferencia: semOrc ? null : Number(raw.valorTotalEstimado),
    publishedAt: raw.dataPublicacaoPncp,
    linkPncp: linkPncpOficial(raw),
    anexos: [
      { nomeDocumento: 'Edital', dataHorarioInclusao: raw.dataPublicacaoPncp, urlChUrl: `https://pncp.gov.br/app/editais/${raw.orgaoEntidade.cnpj}/${raw.anoCompra}/${raw.sequencialCompra}` },
      { nomeDocumento: 'Termo de Referencia', dataHorarioInclusao: raw.dataPublicacaoPncp, urlChUrl: `https://pncp.gov.br/app/editais/${raw.orgaoEntidade.cnpj}/${raw.anoCompra}/${raw.sequencialCompra}` },
    ],
  })
}

editais.sort((a, b) => {
  if (a.encerrado !== b.encerrado) return a.encerrado ? 1 : -1
  const da = a.diasParaEncerrar ?? 9999, db = b.diasParaEncerrar ?? 9999
  if (da !== db) return da - db
  return b.scoreRelevancia - a.scoreRelevancia
})

const snapshot = {
  meta: {
    geradoEm: agora.toISOString(),
    janelaDias: 35,
    brutosCapturados: raws.length,
    aposFiltroQualidade: editais.filter((e) => !e.encerrado).length,
    duplicadosRemovidos: duplicados,
    falsosPositivosDescartados: falsosPositivos,
    matrizBusca: [],
    fonte: 'Dataset-modelo offline (estrutura identica ao snapshot do pipeline PNCP)',
    versaoPipeline: '1.1.0-demo',
  },
  editais,
}

const argsOut = (process.argv.find((a) => a.startsWith('--out=')) ?? '--out=' + path.join(__dirname, '..', 'public', 'data')).split('=')[1]
mkdirSync(argsOut, { recursive: true })
writeFileSync(path.join(argsOut, 'snapshot.json'), JSON.stringify(snapshot))
console.log(`OK: ${editais.length} aprovados, ${falsosPositivos} falsos positivos descartados, ${duplicados} duplicados removidos → ${argsOut}/snapshot.json`)
