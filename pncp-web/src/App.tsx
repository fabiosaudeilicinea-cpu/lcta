import { useEffect, useMemo, useRef, useState } from 'react'
import type { Edital, Snapshot, ViewMode } from './lib/types'
import { CATEGORIAS_LABEL, UFS, FAIXAS_PRECO, PRAZOS } from './lib/funil'

/* ---------------- helpers ---------------- */
const fmtBRL = (v: number | null | undefined) =>
  v == null || v <= 0
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

const fmtData = (iso?: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}
const fmtDataHora = (iso?: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<Edital['status'], string> = {
  aberto: 'Aberto',
  aguardando_abertura: 'Aguardando abertura',
  encerrado: 'Encerrado',
  suspenso: 'Suspenso',
  anulado: 'Anulado',
  fracassada: 'Fracassada',
}

/* ---------------- KPIs ---------------- */
function Kpis({ ativos }: { ativos: Edital[] }) {
  const abertos = ativos.filter((e) => e.status === 'aberto').length
  const urgentes = ativos.filter((e) => !e.encerrado && e.diasParaEncerrar != null && e.diasParaEncerrar <= 7).length
  const comOrcamento = ativos.filter((e) => !e.orcamentoIndisponivel && e.valorReferencia != null)
  const soma = comOrcamento.reduce((acc, e) => acc + (e.valorReferencia ?? 0), 0)
  const ufs = new Set(ativos.map((e) => e.uf)).size

  return (
    <section className="kpis" aria-label="Indicadores">
      <div className="kpi accent-blue">
        <span className="label">Oportunidades ativas</span>
        <div className="value">{ativos.length}</div>
        <span className="hint">{abertos} com recebimento de propostas</span>
      </div>
      <div className="kpi accent-amber">
        <span className="label">Encerram em ≤ 7 dias</span>
        <div className="value">{urgentes}</div>
        <span className="hint">priorize estas análises</span>
      </div>
      <div className="kpi accent-green">
        <span className="label">Valor total estimado</span>
        <div className="value">{fmtBRL(soma)}</div>
        <span className="hint">exclui orçamentos zerados/sigilosos ({ativos.length - comOrcamento.length})</span>
      </div>
      <div className="kpi">
        <span className="label">UFs cobertas</span>
        <div className="value">{ufs}</div>
        <span className="hint">da seleção atual</span>
      </div>
    </section>
  )
}

/* ---------------- Card ---------------- */
function EditalCard({ e, flash }: { e: Edital; flash: boolean }) {
  const [expandido, setExpandido] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (flash && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const t = setTimeout(() => ref.current?.classList.remove('flash'), 2500)
      return () => clearTimeout(t)
    }
  }, [flash])

  const deadlineCls =
    e.diasParaEncerrar != null && !e.encerrado
      ? e.diasParaEncerrar <= 3
        ? 'urgent'
        : e.diasParaEncerrar <= 10
          ? 'soon'
          : ''
      : ''

  return (
    <article
      ref={ref}
      id={`edital-${e.numeroControlePNCP.replace(/[^a-zA-Z0-9]/g, '_')}`}
      className={`card${e.encerrado ? ' muted' : ''}${flash ? ' flash' : ''}`}
    >
      <div className="card-top">
        <span className={`status-pill st-${e.status}`}>{STATUS_LABEL[e.status]}</span>
        <span className="tag-oficial">{e.modalidadeNome}</span>
        <span className="card-score">relevância <b>{e.scoreRelevancia}</b></span>
      </div>

      <h3>{e.objetoCompra}</h3>
      <p className="descritivo">
        {e.descritivo}{' '}
        {e.descritivoFallbackOficial && <span className="tag-oficial">nomenclatura oficial PNCP</span>}
      </p>

      <div className="meta-grid">
        <div><span className="k">Órgão</span><span className="v">{e.orgaoEntidade.razaoSocial}</span></div>
        <div><span className="k">Município / UF</span><span className="v">{e.municipio} / {e.uf}</span></div>
        <div><span className="k">Abertura propostas</span><span className="v">{fmtData(e.dataAberturaProposta)}</span></div>
        <div><span className="k">Encerramento</span><span className="v">{fmtDataHora(e.dataEncerramentoProposta)}</span></div>
        <div>
          <span className="k">Valor estimado</span>
          {e.orcamentoIndisponivel ? (
            <span className="valor sigiloso">Orçamento sigiloso / não informado</span>
          ) : (
            <span className="valor">{fmtBRL(e.valorReferencia)}</span>
          )}
        </div>
        <div>
          <span className="k">Prazo restante</span>
          <span className={`deadline v ${deadlineCls}`}>
            {e.encerrado ? '—' : e.diasParaEncerrar != null ? `${e.diasParaEncerrar} dia(s)` : '—'}
          </span>
        </div>
      </div>

      <div className="tags">
        {e.categorias.map((c) => (
          <span key={c} className="tag-cat">{CATEGORIAS_LABEL[c] ?? c}</span>
        ))}
        {expandido &&
          e.termosMatched.slice(0, 8).map((t) => (
            <span key={t} className="tag-term">{t}</span>
          ))}
      </div>

      {expandido && e.itens && e.itens.length > 0 && (
        <div className="tr-panel">
          <h4>Itens do Termo de Referência</h4>
          {e.itens.map((it, i) => (
            <div key={i} className="tr-item">{it.descricaoItem}</div>
          ))}
        </div>
      )}

      <div className="card-actions">
        <button className="btn btn-sm" onClick={() => setExpandido((v) => !v)}>
          {expandido ? '▲ Recolher' : '▼ Detalhes & termos'}
        </button>
        <a
          className="btn btn-sm"
          href={e.linkPncp}
          target="_blank"
          rel="noreferrer noopener"
          title="Abrir no Portal PNCP"
        >
          ⤓ Baixar anexos / íntegra
        </a>
        <button className="btn btn-sm" onClick={() => window.print()} title="Imprimir/exportar PDF do resumo">
          ⎙ Imprimir resumo
        </button>
        <span className="spacer" />
        <span className="tag-oficial" style={{ alignSelf: 'center' }}>{e.numeroControlePNCP}</span>
      </div>
    </article>
  )
}

/* ---------------- Agenda ---------------- */
function Agenda({ editais, onPick }: { editais: Edital[]; onPick: (e: Edital) => void }) {
  const hoje = new Date()
  const [mes, setMes] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, Edital[]>()
    for (const e of editais) {
      const iso = e.dataEncerramentoProposta ?? e.dataAberturaProposta
      if (!iso) continue
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      ;(map.get(key) ?? map.set(key, []).get(key)!).push(e)
    }
    return map
  }, [editais])

  const cells: { day: Date; other: boolean }[] = []
  const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const iniSemana = (primeiro.getDay() + 6) % 7 // segunda = 0
  for (let i = 0; i < iniSemana; i++) cells.push({ day: new Date(primeiro.getFullYear(), primeiro.getMonth(), -iniSemana + 1 + i), other: true })
  const ultimoDia = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  for (let d = 1; d <= ultimoDia; d++) cells.push({ day: new Date(mes.getFullYear(), mes.getMonth(), d), other: false })
  while (cells.length % 7 !== 0) cells.push({ day: new Date(mes.getFullYear(), mes.getMonth(), ultimoDia + (cells.length % 7) + 1), other: true })

  const ehHoje = (d: Date) => d.toDateString() === hoje.toDateString()

  return (
    <section className="agenda" aria-label="Agenda de certames">
      <header className="agenda-head">
        <button className="btn btn-sm btn-icon" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}>←</button>
        <h3>{mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
        <button className="btn btn-sm btn-icon" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}>→</button>
        <button className="btn btn-sm" onClick={() => setMes(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}>Hoje</button>
        <span className="filter-caption" style={{ marginLeft: 'auto' }}>
          Data exibida = encerramento das propostas (ou abertura, quando não informada)
        </span>
      </header>
      <div className="agenda-grid">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="agenda-dow">{d}</div>
        ))}
        {cells.map(({ day, other }, i) => {
          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
          const evs = eventosPorDia.get(key) ?? []
          return (
            <div key={i} className={`agenda-cell${other ? ' other' : ''}${ehHoje(day) ? ' today' : ''}`}>
              <span className="d">{day.getDate()}</span>
              {evs.slice(0, 3).map((e) => (
                <button
                  key={e.numeroControlePNCP}
                  className={`agenda-event${e.encerrado ? ' encerrado' : ''}${!e.encerrado && e.diasParaEncerrar != null && e.diasParaEncerrar <= 3 ? ' urgente' : ''}`}
                  title={`${e.objetoCompra} — ${e.municipio}/${e.uf}`}
                  onClick={() => onPick(e)}
                >
                  {e.uf} · {fmtBRL(e.valorReferencia)}
                </button>
              ))}
              {evs.length > 3 && <span className="agenda-more">+{evs.length - 3} mais</span>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ---------------- App ---------------- */
export default function App() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const [ufsSel, setUfsSel] = useState<Set<string>>(new Set())
  const [catsSel, setCatsSel] = useState<Set<string>>(new Set())
  const [prazo, setPrazo] = useState<string>('todos')
  const [faixa, setFaixa] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [view, setView] = useState<ViewMode>('lista')
  const [flashId, setFlashId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/snapshot.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<Snapshot>
      })
      .then(setSnap)
      .catch((e) => setErro(`Falha ao carregar snapshot dos editais (${String(e)}). Gere-o com "npm run pipeline".`))
  }, [])

  const todos = snap?.editais ?? []

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const list = todos.filter((e) => {
      if (ufsSel.size > 0 && !ufsSel.has(e.uf)) return false
      if (catsSel.size > 0 && !e.categorias.some((c) => catsSel.has(c))) return false
      if (faixa) {
        const f = FAIXAS_PRECO.find((x) => x.id === faixa)
        const v = e.valorReferencia
        if (!f || v == null || v <= 0) return false
        if (!(v >= f.min && v < f.max)) return false
      }
      if (prazo !== 'todos') {
        if (e.encerrado) return false
        if (prazo === 'abertos') {
          /* mantém todos não encerrados */
        } else {
          const dias = Number(prazo.replace('d', ''))
          if (e.diasParaEncerrar == null || e.diasParaEncerrar > dias) return false
        }
      }
      if (q) {
        const alvo = `${e.objetoCompra} ${e.descritivo} ${e.orgaoEntidade.razaoSocial} ${e.municipio} ${e.termosMatched.join(' ')}`.toLowerCase()
        if (!alvo.includes(q)) return false
      }
      return true
    })
    // Abertos primeiro (urgência → relevância), encerrados suavizados ao fim
    return list.sort((a, b) => {
      if (a.encerrado !== b.encerrado) return a.encerrado ? 1 : -1
      const da = a.diasParaEncerrar ?? 9999
      const db = b.diasParaEncerrar ?? 9999
      if (da !== db) return da - db
      return b.scoreRelevancia - a.scoreRelevancia
    })
  }, [todos, ufsSel, catsSel, prazo, faixa, busca])

  const toggle = (set: Set<string>, v: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set)
    n.has(v) ? n.delete(v) : n.add(v)
    setter(n)
  }
  const limpar = () => {
    setUfsSel(new Set()); setCatsSel(new Set()); setPrazo('todos'); setFaixa(''); setBusca('')
  }
  const irParaCard = (e: Edital) => {
    setView('lista')
    setFlashId(e.numeroControlePNCP)
    setTimeout(() => setFlashId(null), 3000)
  }

  const ativos = filtrados.filter((e) => !e.encerrado)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">⚖️</div>
          <div>
            <h1>EditalTech</h1>
            <p>Monitor de editais PNCP · Desenvolvimento Web &amp; TI</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="badge-source">Fonte: API Pública PNCP · Lei 14.133/2021</span>
          <button
            className={`btn btn-topbar${view === 'lista' ? ' on' : ''}`}
            onClick={() => setView('lista')}
          >📋 Lista</button>
          <button
            className={`btn btn-topbar${view === 'agenda' ? ' on' : ''}`}
            onClick={() => setView('agenda')}
          >📅 Agenda</button>
        </div>
      </header>

      <main className="main">
        {erro && <div className="error-box">{erro}</div>}
        {!snap && !erro && (
          <div className="progress-wrap">
            <h3>Carregando snapshot…</h3>
            <p>Dados pré-processados pelo funil de ingestão do PNCP.</p>
            <div className="progress-bar"><i style={{ width: '60%' }} /></div>
          </div>
        )}

        {snap && (
          <>
            <Kpis ativos={ativos} />

            <section className="funnel" aria-label="Funil de dados">
              Funil PNCP: <b>{snap.meta.brutosCapturados}</b> brutos
              <span className="arrow">→</span> dedupe (<b>-{snap.meta.duplicadosRemovidos}</b>)
              <span className="arrow">→</span> falsos positivos descartados (<b>-{snap.meta.falsosPositivosDescartados}</b>)
              <span className="arrow">→</span> <b>{snap.meta.aposFiltroQualidade}</b> aprovados
              <span className="arrow">·</span> atualizado {fmtDataHora(snap.meta.geradoEm)}
            </section>

            <section className="toolbar" aria-label="Filtros">
              <div className="toolbar-row">
                <div className="field" style={{ flex: 1, minWidth: 240 }}>
                  <label htmlFor="busca">Busca livre</label>
                  <input
                    id="busca"
                    className="search-input"
                    placeholder="Ex.: portal, aplicativo, manutenção de sistema…"
                    value={busca}
                    onChange={(ev) => setBusca(ev.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Prazo (único)</label>
                  <select value={prazo} onChange={(ev) => setPrazo(ev.target.value)}>
                    {PRAZOS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Faixa de preço (única)</label>
                  <select value={faixa} onChange={(ev) => setFaixa(ev.target.value)}>
                    <option value="">Todas as faixas</option>
                    {FAIXAS_PRECO.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <button className="link-reset" onClick={limpar}>Limpar filtros</button>
              </div>

              <div className="toolbar-row" style={{ marginTop: 12 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label><span className="filter-caption">Estado/UF (múltipla · nada marcado = todas)</span></label>
                  <div className="chip-group">
                    {UFS.map((uf) => (
                      <button key={uf} className={`chip uf${ufsSel.has(uf) ? ' on' : ''}`} onClick={() => toggle(ufsSel, uf, setUfsSel)}>
                        {uf}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="toolbar-row" style={{ marginTop: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label><span className="filter-caption">Categoria de tecnologia (múltipla · nada marcado = todas)</span></label>
                  <div className="chip-group">
                    {Object.entries(CATEGORIAS_LABEL).map(([id, label]) => (
                      <button key={id} className={`chip${catsSel.has(id) ? ' on' : ''}`} onClick={() => toggle(catsSel, id, setCatsSel)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {view === 'agenda' ? (
              <Agenda editais={filtrados} onPick={irParaCard} />
            ) : (
              <>
                <div className="list-head">
                  <h2>Editais</h2>
                  <span className="count">
                    {ativos.length} ativo(s) · {filtrados.length - ativos.length} encerrado(s) ao final (fora das métricas)
                  </span>
                </div>
                {filtrados.length === 0 ? (
                  <div className="empty">
                    <div className="big">🔎</div>
                    Nenhum edital corresponde aos filtros atuais.<br />
                    Ajuste a matriz de busca ou clique em “Limpar filtros”.
                  </div>
                ) : (
                  <div className="cards">
                    {filtrados.map((e) => (
                      <EditalCard key={e.numeroControlePNCP} e={e} flash={flashId === e.numeroControlePNCP} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        EditalTech · pipeline PNCP v{snap?.meta.versaoPipeline ?? '—'} · fonte: {snap?.meta.fonte ?? 'API Pública PNCP'}
      </footer>
    </div>
  )
}
