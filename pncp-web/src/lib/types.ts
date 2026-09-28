/* ============================================================================
 * Modelo de dados — espelha o contrato público da API de Consultas do PNCP
 * (https://pncp.gov.br/api/consulta) + campos derivados do nosso pipeline.
 * ==========================================================================*/

/** Entidade/órgão publicador (contrato oficial PNCP). */
export interface OrgaoEntidade {
  cnpj: string
  razaoSocial: string
  poderId?: string | null // E | L | D | N
  esferaId?: string | null // F | E | D | M
}

export interface UnidadeOrgao {
  ufSigla: string
  ufNome: string
  municipioNome: string
  codigoIbge?: string
  nomeUnidade?: string
  codigoUnidade?: string
}

export interface AmparoLegal {
  codigo?: number
  nome?: string
  descricao?: string
}

/** Item do Termo de Referência / lista de itens (endpoint .../contratacoes/{numeroControlePNCP}/itens). */
export interface ItemCompra {
  sequencialItem?: number
  descricaoItem?: string
  qtdProduto?: number | string
  unidadeMedidaProduto?: string
  valorTotalItem?: number | null
  situacaoCompraItemId?: number
  situacaoCompraItemNome?: string
}

/** Registro "cru" retornado pela API pública do PNCP. */
export interface PncpCompraRaw {
  numeroControlePNCP: string
  anoCompra: number
  sequencialCompra: number
  numeroCompra: string
  processo?: string
  objetoCompra: string
  informacaoComplementar?: string | null
  modalidadeId: number
  modalidadeNome: string
  modoDisputaId?: number
  modoDisputaNome?: string
  amparoLegal?: AmparoLegal | null
  orgaoEntidade: OrgaoEntidade
  orgaoSubRogado?: OrgaoEntidade | null
  unidadeOrgao: UnidadeOrgao
  unidadeSubRogada?: UnidadeOrgao | null
  dataPublicacaoPncp: string
  dataInclusao?: string
  dataAtualizacao?: string
  dataAberturaProposta: string
  dataEncerramentoProposta: string
  dataClassaudeHabilitacao?: string | null
  situacaoCompraId?: number
  situacaoCompraNome?: string
  valorTotalEstimado: number | null
  valorTotalHomologado?: number | null
  srp?: boolean
  tipoInstrumentoConvocatorioCodigo?: number
  tipoInstrumentoConvocatorioNome?: string
  linkSistemaOrigem?: string | null
  linkProcessoEletronico?: string | null
  justificativaPresencial?: string | null
  emendaParlamentar?: unknown
  recursosAdministrativos?: Array<{
    arquivo?: string
    urlAnexo?: string
    tamanho?: string
    dataHora?: string
  }> | null
  fontesOrcamentarias?: unknown[]
  usuarioNome?: string
}

/** Anexo (documentação de apoio) enriquecido via endpoint de documentação. */
export interface EditalAnexo {
  id?: number
  nomeArquivo?: string
  url: string
  tipo?: string
  dataHora?: string
  tamanho?: string
}

/** Categorias de tecnologia usadas no funil de classificação. */
export type CategoriaTech =
  | 'software_web'
  | 'portais_apps'
  | 'integracao_api'
  | 'infra_cloud'
  | 'dados_bi'
  | 'seguranca'
  | 'suporte_manutencao'
  | 'outros_ti'

/** Registro limpo, deduplicado e classificado — pronto para a UI. */
export interface Edital extends PncpCompraRaw {
  /** Chave canônica de desduplicação */
  dedupeKey: string
  /** Itens do TR (quando disponíveis) */
  itens?: ItemCompra[]
  /** Anexos/download dos editais */
  anexos?: EditalAnexo[]
  /** Descritivo extraído com segurança (TR/itens) ou fallback nomenclatura oficial */
  descritivo: string
  /** true => usamos apenas a nomenclatura oficial (regra de segurança de parsing) */
  descritivoFallbackOficial: boolean
  categorias: CategoriaTech[]
  termosMatched: string[]
  scoreRelevancia: number
  /** Orçamento zerado/sigiloso detectado (não entra nas métricas financeiras) */
  orcamentoIndisponivel: boolean
  /** Status derivado das datas */
  status: 'aberto' | 'aguardando_abertura' | 'encerrado' | 'suspenso' | 'anulado' | 'fracassada'
  encerrado: boolean
  diasParaEncerrar: number | null
  uf: string
  municipio: string
  esfera: string
  valorReferencia: number | null
  publishedAt: string
  /** URL pública do edital no PNCP */
  linkPncp: string
}

/** Payload do snapshot gerado pelo pipeline. */
export interface SnapshotMeta {
  geradoEm: string
  janelaDias: number
  brutosCapturados: number
  aposFiltroQualidade: number
  duplicadosRemovidos: number
  falsosPositivosDescartados: number
  matrizBusca: { termo: string; ufs: string[] }[]
  fonte: string
  versaoPipeline: string
}

export interface Snapshot {
  meta: SnapshotMeta
  editais: Edital[]
}

export type ViewMode = 'lista' | 'agenda'
