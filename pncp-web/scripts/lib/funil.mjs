/* ============================================================================
 * Gêmeo do FUNIL compartilhado com src/lib/funil.ts (manter em sincronia).
 * Usado pelo pipeline Node e pelo gerador de snapshot estático.
 * ==========================================================================*/

export function normalize(s) {
  if (!s) return ''
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function termRegex(term) {
  const escaped = normalize(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])(${escaped})([^a-z0-9]|$)`, 'i')
}

/* A. MATRIZ DE BUSCA — 50 termos-chave de tecnologia / desenvolvimento web */
export const TERMOS_CHAVE = [
  { termo: 'desenvolvimento web', categoria: 'software_web', peso: 10 },
  { termo: 'desenvolvimento de software', categoria: 'software_web', peso: 10 },
  { termo: 'criacao de sistema', categoria: 'software_web', peso: 9 },
  { termo: 'sistema web', categoria: 'software_web', peso: 9 },
  { termo: 'fabrica de software', categoria: 'software_web', peso: 10 },
  { termo: 'desenvolvimento de aplicacao', categoria: 'software_web', peso: 9 },
  { termo: 'programacao de sistemas', categoria: 'software_web', peso: 8 },
  { termo: 'desenvolvimento de plataformas digitais', categoria: 'software_web', peso: 9 },
  { termo: 'desenvolvimento front-end', categoria: 'software_web', peso: 9 },
  { termo: 'desenvolvimento back-end', categoria: 'software_web', peso: 9 },
  { termo: 'manutencao evolutiva de software', categoria: 'software_web', peso: 8 },
  { termo: 'customizacao de sistema', categoria: 'software_web', peso: 7 },
  { termo: 'implantacao de sistema informatizado', categoria: 'software_web', peso: 7 },
  { termo: 'solucao digital', categoria: 'software_web', peso: 6 },
  { termo: 'transformacao digital', categoria: 'software_web', peso: 6 },

  { termo: 'criacao de portal', categoria: 'portais_apps', peso: 9 },
  { termo: 'portal da transparencia', categoria: 'portais_apps', peso: 6 },
  { termo: 'portal corporativo', categoria: 'portais_apps', peso: 8 },
  { termo: 'aplicativo mobile', categoria: 'portais_apps', peso: 9 },
  { termo: 'aplicativos moveis', categoria: 'portais_apps', peso: 9 },
  { termo: 'aplicativo web', categoria: 'portais_apps', peso: 9 },
  { termo: 'site institucional', categoria: 'portais_apps', peso: 7 },
  { termo: 'desenvolvimento de site', categoria: 'portais_apps', peso: 9 },
  { termo: 'e-commerce', categoria: 'portais_apps', peso: 7 },
  { termo: 'loja virtual', categoria: 'portais_apps', peso: 6 },
  { termo: 'chatbot', categoria: 'portais_apps', peso: 7 },
  { termo: 'assistente virtual', categoria: 'portais_apps', peso: 5 },

  { termo: 'integracao de sistemas', categoria: 'integracao_api', peso: 8 },
  { termo: 'api', categoria: 'integracao_api', peso: 6 },
  { termo: 'interfaces de programacao', categoria: 'integracao_api', peso: 7 },
  { termo: 'web service', categoria: 'integracao_api', peso: 7 },
  { termo: 'middleware de integracao', categoria: 'integracao_api', peso: 7 },
  { termo: 'gateway de aplicacoes', categoria: 'integracao_api', peso: 6 },
  { termo: 'interoperabilidade', categoria: 'integracao_api', peso: 5 },

  { termo: 'computacao em nuvem', categoria: 'infra_cloud', peso: 6 },
  { termo: 'hospedagem de sistema', categoria: 'infra_cloud', peso: 6 },
  { termo: 'hospedagem de site', categoria: 'infra_cloud', peso: 6 },
  { termo: 'cloud', categoria: 'infra_cloud', peso: 4 },
  { termo: 'devops', categoria: 'infra_cloud', peso: 8 },
  { termo: 'containerizacao', categoria: 'infra_cloud', peso: 7 },
  { termo: 'migracao de dados', categoria: 'infra_cloud', peso: 5 },

  { termo: 'business intelligence', categoria: 'dados_bi', peso: 7 },
  { termo: 'painel de indicadores', categoria: 'dados_bi', peso: 5 },
  { termo: 'data warehouse', categoria: 'dados_bi', peso: 6 },
  { termo: 'big data', categoria: 'dados_bi', peso: 6 },
  { termo: 'inteligencia artificial', categoria: 'dados_bi', peso: 6 },
  { termo: 'analytics', categoria: 'dados_bi', peso: 4 },
  { termo: 'visualizacao de dados', categoria: 'dados_bi', peso: 6 },

  { termo: 'seguranca da informacao', categoria: 'seguranca', peso: 5 },
  { termo: 'pen test', categoria: 'seguranca', peso: 7 },
  { termo: 'teste de invasao', categoria: 'seguranca', peso: 6 },
  { termo: 'certificado digital', categoria: 'seguranca', peso: 2 },

  { termo: 'suporte tecnico especializado', categoria: 'suporte_manutencao', peso: 4 },
  { termo: 'manutencao corretiva', categoria: 'suporte_manutencao', peso: 4 },
  { termo: 'sustentacao de sistemas', categoria: 'suporte_manutencao', peso: 6 },

  { termo: 'tecnologia da informacao', categoria: 'outros_ti', peso: 3 },
  { termo: 'tic', categoria: 'outros_ti', peso: 2 },
]

export const CATEGORIAS_LABEL = {
  software_web: 'Desenvolvimento de Software Web',
  portais_apps: 'Portais, Sites & Aplicativos',
  integracao_api: 'Integrações & APIs',
  infra_cloud: 'Infraestrutura & Cloud/DevOps',
  dados_bi: 'Dados, BI & IA',
  seguranca: 'Segurança da Informação',
  suporte_manutencao: 'Sustentação & Manutenção',
  outros_ti: 'Outros Serviços de TI',
}

/* B. FILTRO DE FALSOS POSITIVOS */
const ex = (id, descricao, pattern) => ({ id, descricao, pattern })

export const REGRAS_EXCLUSAO = [
  ex('hardware_pc', 'Hardware/periféricos (cooler, gabinete, mouse…)', /\b(cooler|gabinete|mouse|teclado|monitor de (video|lcd|led)|hd ssd|pendrive|cartao de memoria|impressora|toner|cartucho)\b/i),
  ex('cabo_rede', 'Insumos de infraestrutura física de rede (cabo, bobina, patch cord)', /\b(bobina de cabo|cabo de (rede|par trancado|fibra utp|coaxial)|patch cord|switch (de rede|poE )?(?!desenvolvimento)|rj[- ]?45|rack (de|para))\b/i),
  ex('placa_arcondicionado', 'Placas eletrônicas de equipamentos (ar-condicionado, nobreak)', /\b(placa (eletronica|eletr[o0]nica|de controle|controladora)[^.]{0,60}(ar[- ]?condicionado|nobreak|refrigerad|inversor)|placa (eletronica|eletr[o0]nica) (de|para) (ar|nobreak))\b/i),
  ex('climatizacao', 'Climatização/infraestrutura predativa de CPD', /\b(ar[- ]?condicionado|climatizad|piso elevado|no-break|nobreake?s?\b|gerador de energia|estabilizador)\b/i),
  ex('moveis_ti', 'Mobiliário para laboratórios/CPIs', /\b(mobili[áa]rio (para|de) (laborat|[ck]|escrivaninha)|cadeira ergometrica|escrivaninha|armario (a[e]? )?alto)\b/i),
  ex('licenca_readypurchase', 'Aquisição/licença de software pronto, sem desenvolvimento', /\b(licen[çc]a(s)? (de|do|para) (software|sistema|programa|windows|office|autocad|antiv[ií]rus|adobe|oracle|sap)|aquisi[çc][ãa]o de licen|renova[çc][ãa]o de licen|assinatura (de|do) (software|sistema))\b/i),
  ex('obra_fisica', 'Obra/projeto executivo de infraestrutura física', /\b(projeto executivo (de|para)? ?(obra|edifica|constru|pavimenta|drenagem)|constru[çc][ãa]o (de|da) (sede|pr[eé]dio|quadra|pavilh|creche|escola|uas|ubds)|pavimenta|terrapienagem|recapeamento)\b/i),
  ex('suporte_presencial', 'Suporte presencial continuado de hardware', /\b(suporte (t[eé]cnico )?(presencial|de campo)|manuten[çc][ãa]o (preventiva|corretiva) (de|em) (computador|equipamento|notebook|desktop|impressora|hardware)|assist[eê]ncia t[eé]cnica (de|em) (micro|computador|equipamento))\b/i),
  ex('curso_capacitacao', 'Treinamentos/cursos de informática (não é dev sob demanda)', /\b(curso|treinamento|capacita[çc][ãa]o) (de|em|para)? ?(inform[aá]tica|excel|word|programa[çc][ãa]o b[aá]sica|digitaca)\b/i),
  ex('energia_telecom', 'Serviços concessionados (energia/telefonia/SMP)', /\b(energia el[eé]trica|conta[s]? (de )?(luz|telefone|internet (fixa|móvel))|servi[çc]o (de )?(telefonia|celular|smp|stfc)|link dedicado de dados (sem desenvolvimento)?)\b/i),
  ex('material_consumo', 'Material de consumo/expediente', /\b(papel (sulfate|of[fí]cio)|material (de )?(consumo|expediente)|caneta|r[eé]gua|caderno)\b/i),
  ex('veiculos_maquinas', 'Veículos, máquinas e equipamentos agrícolas', /\b(locadora de veiculo|manuten[çc][ãa]o de (ve[ií]culo|frota|maquina|trator|retroescavadeira)|combust[ií]vel)\b/i),
  ex('consultoria_generica', 'Consultorias não-TI que citam "sistema"', /\b(consultoria (cont[aá]bil|tribut[aá]ria|jur[ií]dica|ambiental|previdenci[aá]ria)|auditoria (cont[aá]bil|financeira))\b/i),
  ex('vigilancia_limpeza', 'Serviços terceirizados operacionais', /\b(vigilancia|portaria|limpeza|desinsetiza|merenda|uniforme)\b/i),
  ex('projeto_arquitetura', 'Softwares de projeto/arquitetura prontos (BIM/CAD compra)', /\b(modelagem bim (de obra|predial)|licen[çc]a (bim|autocad|revit|sketchup))\b/i),
]

const SINAIS_SERVICO_TI =
  /\b(desenvolv|implanta|customiz|integr|manuten[çc][ãa]o (evolutiva|adaptativa)|sustenta|hospeda|portal|aplicativ|softwar|sistema (informatizado|web|de gest)|solu[çc][ãa]o (de|em) (ti|tecnologia|software)|fabrica|programa(dor|çç)|front[- ]?end|back[- ]?end|api|web service|banco de dados|cloud|nuvem)\b/i

const SINAIS_MATERIAL =
  /\b(aquisi[çc][ãa]o (de )?(equipamento|computador|notebook|servidor f[ií]sico|hardware|insumo|material)|fornecimento de (equipamento|computador|notebook|aparelho))\b/i

const SINAIS_MAO_OBRA_PRESENCIAL =
  /\b(aloca[çc][ãa]o (de )?(m[ãa]o de obra|profissionais) (dedicada|continuada|presencial)|post(?:o|os)? (de )?trabalho f[ií]sico|dedica[çc][ãa]o exclusiva com (presen[çc]|aloca)|assistente (administrativo|operacional)|merendeira|agente (de combate|comunit[aá]rio)|frete|carpinteiro|pedreiro|eletricista)\b/i

export function textoAnalisavel(c) {
  const itens = (c.itens ?? []).map((i) => i.descricaoItem ?? '').join(' ')
  return normalize([c.objetoCompra, c.informacaoComplementar, itens].join(' . '))
}

export function classificarEdital(c) {
  const texto = textoAnalisavel(c)
  const termosMatched = []
  let score = 0
  const categorias = new Set()

  for (const t of TERMOS_CHAVE) {
    if (termRegex(t.termo).test(texto)) {
      termosMatched.push(t.termo)
      score += t.peso
      categorias.add(t.categoria)
    }
  }

  const excluidoPor = REGRAS_EXCLUSAO.filter((r) => r.pattern.test(texto)).map((r) => r.id)

  const ehServicoTi = SINAIS_SERVICO_TI.test(texto)
  const ehMaterial = SINAIS_MATERIAL.test(texto)
  const natureza =
    termosMatched.length === 0 && !ehServicoTi
      ? 'nao_ti'
      : ehMaterial && ehServicoTi
        ? 'misto'
        : ehMaterial
          ? 'material'
          : 'servico_ti'

  const maoDeObraPresencial = SINAIS_MAO_OBRA_PRESENCIAL.test(texto)

  const centroObjeto = normalize(c.objetoCompra).slice(0, 220)
  for (const t of TERMOS_CHAVE) {
    if (t.peso >= 8 && termRegex(t.termo).test(centroObjeto)) score += 3
  }
  score -= excluidoPor.length * 12
  if (maoDeObraPresencial) score -= 15
  if (natureza === 'material') score -= 20

  return { termosMatched, categorias: [...categorias], scoreRelevancia: Math.max(0, score), excluidoPor, natureza, maoDeObraPresencial }
}

export function devePassarNoFunil(r) {
  if (r.termosMatched.length === 0) return false
  if (r.scoreRelevancia < 5) return false
  if (r.excluidoPor.length > 0 && r.natureza !== 'servico_ti') return false
  if (r.maoDeObraPresencial && r.natureza !== 'servico_ti') return false
  if (r.natureza === 'material') return false
  return true
}

export function dedupeKey(c) {
  if (c.numeroControlePNCP) return c.numeroControlePNCP
  return `${c.orgaoEntidade?.cnpj ?? 'x'}|${normalize(c.objetoCompra).slice(0, 120)}|${(c.dataAberturaProposta ?? '').slice(0, 10)}`
}

export function orcamentoIndisponivel(valorEstimado) {
  return valorEstimado == null || Number.isNaN(Number(valorEstimado)) || Number(valorEstimado) <= 0
}

export function derivarStatus(c, agora = new Date()) {
  const situacao = normalize(c.situacaoCompraNome)
  if (situacao.includes('anul')) return { status: 'anulado', encerrado: true, diasParaEncerrar: null }
  if (situacao.includes('suspen')) return { status: 'suspenso', encerrado: false, diasParaEncerrar: null }
  if (situacao.includes('fracass') || situacao.includes('desert')) return { status: 'fracassada', encerrado: true, diasParaEncerrar: null }

  const enc = c.dataEncerramentoProposta ? new Date(c.dataEncerramentoProposta) : null
  const abert = c.dataAberturaProposta ? new Date(c.dataAberturaProposta) : null
  if (!enc) return { status: 'encerrado', encerrado: true, diasParaEncerrar: null }

  const msDia = 86_400_000
  const diasRestantes = Math.ceil((enc.getTime() - agora.getTime()) / msDia)
  if (diasRestantes < 0) return { status: 'encerrado', encerrado: true, diasParaEncerrar: 0 }
  if (abert && abert.getTime() > agora.getTime()) return { status: 'aguardando_abertura', encerrado: false, diasParaEncerrar: diasRestantes }
  return { status: 'aberto', encerrado: false, diasParaEncerrar: diasRestantes }
}

export const RE_DESCRITIVO_TR =
  /(2\.?\s*DO\s+OBJETO|OBJETO\s+DA\s+(LICITA|CONTRATA)|DESCR[IÍ]C[ÃA]O\s+(RESUMIDA\s+)?DO\s+OBJETO)[:\s-]+(.{40,600}?)(?:\r?\n\s*\d|PAR[ÁA]GRAFO|$)/i

export function extrairDescritivoSeguro(objetoOficial, itens, trTexto) {
  const descItens = (itens ?? []).map((i) => (i.descricaoItem ?? '').trim()).filter(Boolean)
  if (descItens.length > 0) {
    const joined = descItens.join(' | ')
    if (joined.length >= 20 && !/[<>{}]|base64|%[0-9a-f]{2}/i.test(joined)) {
      return { descritivo: joined.slice(0, 700), fallbackOficial: false }
    }
  }
  if (trTexto) {
    const m = RE_DESCRITIVO_TR.exec(trTexto)
    if (m && m[3] && m[3].trim().length >= 40 && !/\?{3,}|Âª|\uFFFD/.test(m[3])) {
      return { descritivo: m[3].trim().slice(0, 700), fallbackOficial: false }
    }
  }
  return { descritivo: normalize(objetoOficial).length > 0 ? objetoOficial.trim() : '', fallbackOficial: true }
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SE', 'SP', 'TO',
]

export const FAIXAS_PRECO = [
  { id: 'ate50k', label: 'Até R$ 50 mil', min: 0, max: 50_000 },
  { id: '50k_250k', label: 'R$ 50 mil – R$ 250 mil', min: 50_000, max: 250_000 },
  { id: '250k_1mi', label: 'R$ 250 mil – R$ 1 milhão', min: 250_000, max: 1_000_000 },
  { id: 'acima1mi', label: 'Acima de R$ 1 milhão', min: 1_000_000, max: Infinity },
]

export const PRAZOS = [
  { id: 'todos', label: 'Todos os prazos' },
  { id: '7d', label: 'Encerra em até 7 dias' },
  { id: '15d', label: 'Encerra em até 15 dias' },
  { id: '30d', label: 'Encerra em até 30 dias' },
  { id: 'abertos', label: 'Todos os abertos' },
]
