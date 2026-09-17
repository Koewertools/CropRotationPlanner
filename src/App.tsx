import { useDeferredValue, useEffect, useState, useTransition } from 'react'
import { ArrowRight, Check, ChevronDown, Info, RotateCcw, Search, Sprout } from 'lucide-react'
import './App.css'
import { AUTO_CATCH, FALLOW_ID, NO_CATCH, REQUIRED_CATCH, displayName, model, optimizeRotations, type Category, type RotationResult } from './rotationModel'

const DEFAULT_CROPS = ['WHEAT', 'BARLEY', 'OAT', 'SOYBEAN', 'CLOVER', 'MAIZE', 'CANOLA', 'POTATO']
const categories: Record<Category, string> = {
  Grain: 'Getreide', Legume: 'Leguminosen', 'Oil & industrial': 'Öl- & Industriepflanzen',
  'Root & vegetable': 'Hackfrüchte & Gemüse', 'Grass & forage': 'Grünland & Futter', Specialty: 'Weitere Kulturen',
}
const initialPolicies = () => Object.fromEntries(model.crops.map(crop => [crop.id, NO_CATCH]))
const initialLimits = () => Object.fromEntries(model.crops.map(crop => [crop.id, 1]))
const percent = (value: number, signed = false) => `${signed && value > 0 ? '+' : ''}${Math.round(value * 100)} %`
const STORAGE_KEY = 'fs25-crop-rotation-planner-v1'

interface SavedPlannerState {
  selected: string[]
  length: number
  resultLimit: number
  fallow: boolean
  policies: Record<string, string>
  allowedAfter: Record<string, boolean>
  limits: Record<string, number>
}

function defaultPlannerState(): SavedPlannerState {
  return {
    selected: DEFAULT_CROPS,
    length: 6,
    resultLimit: 10,
    fallow: false,
    policies: initialPolicies(),
    allowedAfter: {},
    limits: initialLimits(),
  }
}

function loadPlannerState(): SavedPlannerState {
  const defaults = defaultPlannerState()
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaults
    const parsed = JSON.parse(stored) as Partial<SavedPlannerState>
    const validCropIds = new Set(model.crops.filter(crop => !crop.ignoreInPlanner).map(crop => crop.id))
    const validCatchIds = new Set([NO_CATCH, AUTO_CATCH, REQUIRED_CATCH, ...model.catchCrops.map(crop => crop.id)])
    const selected = Array.isArray(parsed.selected)
      ? parsed.selected.filter((cropId): cropId is string => typeof cropId === 'string' && validCropIds.has(cropId))
      : defaults.selected
    const policies = Object.fromEntries(Object.entries(parsed.policies ?? {}).filter(([cropId, policy]) => validCropIds.has(cropId) && typeof policy === 'string' && validCatchIds.has(policy)))
    const allowedAfter = Object.fromEntries(Object.entries(parsed.allowedAfter ?? {}).filter(([cropId, value]) => validCropIds.has(cropId) && typeof value === 'boolean')) as Record<string, boolean>
    const limits = Object.fromEntries(Object.entries(parsed.limits ?? {}).filter(([cropId, value]) => validCropIds.has(cropId) && typeof value === 'number' && Number.isFinite(value)).map(([cropId, value]) => [cropId, Math.max(1, Math.min(14, Math.floor(value)))])) as Record<string, number>
    return {
      selected,
      length: typeof parsed.length === 'number' ? Math.max(2, Math.min(14, Math.floor(parsed.length))) : defaults.length,
      resultLimit: typeof parsed.resultLimit === 'number' ? Math.max(1, Math.min(500, Math.floor(parsed.resultLimit))) : defaults.resultLimit,
      fallow: typeof parsed.fallow === 'boolean' ? parsed.fallow : defaults.fallow,
      policies: { ...defaults.policies, ...policies },
      allowedAfter,
      limits: { ...defaults.limits, ...limits },
    }
  } catch {
    return defaults
  }
}

function App() {
  const [initialState] = useState(loadPlannerState)
  const [selected, setSelected] = useState(initialState.selected)
  const [length, setLength] = useState(initialState.length)
  const [resultLimit, setResultLimit] = useState(initialState.resultLimit)
  const [fallow, setFallow] = useState(initialState.fallow)
  const [policies, setPolicies] = useState<Record<string, string>>(initialState.policies)
  const [allowedAfter, setAllowedAfter] = useState<Record<string, boolean>>(initialState.allowedAfter)
  const [limits, setLimits] = useState<Record<string, number>>(initialState.limits)
  const [search, setSearch] = useState('')
  const [onlySelected, setOnlySelected] = useState(false)
  const query = useDeferredValue(search).trim().toLocaleLowerCase('de')
  const [results, setResults] = useState<RotationResult[]>(() => optimizeRotations(initialState.fallow ? [...initialState.selected, FALLOW_ID] : initialState.selected, initialState.length, initialState.policies, { ...initialState.limits, [FALLOW_ID]: 1 }, initialState.resultLimit, initialState.allowedAfter))
  const [expanded, setExpanded] = useState<string | null>(results[0]?.id ?? null)
  const [dirty, setDirty] = useState(false)
  const [pending, startTransition] = useTransition()
  const crops = model.crops.filter(crop => !crop.ignoreInPlanner)
  const visible = crops.filter(crop => crop.name.toLocaleLowerCase('de').includes(query) && (!onlySelected || selected.includes(crop.id)))
  const capacity = selected.reduce((sum, id) => sum + (limits[id] ?? 1), fallow ? 1 : 0)
  const change = (action: () => void) => { action(); setDirty(true) }
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ selected, length, resultLimit, fallow, policies, allowedAfter, limits } satisfies SavedPlannerState))
  }, [selected, length, resultLimit, fallow, policies, allowedAfter, limits])
  const generate = () => startTransition(() => {
    const next = optimizeRotations(fallow ? [...selected, FALLOW_ID] : selected, length, policies, { ...limits, [FALLOW_ID]: 1 }, resultLimit, allowedAfter)
    setResults(next); setExpanded(next[0]?.id ?? null); setDirty(false)
  })
  const reset = () => {
    setSelected(DEFAULT_CROPS); setLength(6); setResultLimit(10); setFallow(false); setPolicies(initialPolicies())
    setAllowedAfter({}); setLimits(initialLimits()); setSearch(''); setOnlySelected(false)
    startTransition(() => {
      const next = optimizeRotations(DEFAULT_CROPS, 6, initialPolicies(), initialLimits())
      setResults(next); setExpanded(next[0]?.id ?? null); setDirty(false)
    })
  }

  return <div className="app-shell">
    <header className="topbar">
      <a href="#planner" className="brand"><Sprout size={23} /><span>Fruchtfolgeplaner</span><small>FS25</small></a>
      <nav aria-label="Seitennavigation"><a href="#planner">Planung</a><a href="#results">Ergebnisse</a><a href="#methodology">Berechnungsgrundlage</a></nav>
    </header>
    <main>
      <section id="planner">
        <div className="page-heading"><div><p className="eyebrow">FS25 · Crop Rotation</p><h1>Fruchtfolge planen</h1><p>Kulturen und Anbaugrenzen festlegen, Fruchtfolgen berechnen und vergleichen.</p></div>
          <button type="button" className="secondary-button" onClick={reset}><RotateCcw size={15} /> Zurücksetzen</button>
        </div>
        <div className="workspace">
          <section className="panel crop-panel" aria-labelledby="crops-title">
            <div className="panel-heading"><h2 id="crops-title">Kulturen</h2><span className="count">{selected.length} ausgewählt</span></div>
            <div className="toolbar">
              <label className="search"><Search size={17} /><input aria-label="Kulturen suchen" placeholder="Kultur suchen …" value={search} onChange={event => setSearch(event.target.value)} /></label>
              <label className="filter"><input type="checkbox" checked={onlySelected} onChange={event => setOnlySelected(event.target.checked)} /> Nur Auswahl</label>
              <button type="button" className="text-button" onClick={() => change(() => setSelected(crops.map(crop => crop.id)))}>Alle</button>
              <button type="button" className="text-button" onClick={() => change(() => setSelected([]))}>Keine</button>
            </div>
            <div className="rule-note"><Info size={16} /><p><strong>Zwischenfrucht:</strong> „Danach nicht möglich“ hat Vorrang vor dem Wunsch der Folgekultur – auch am Ende des Zyklus.</p></div>
            <div className="column-head" aria-hidden="true"><span>Kultur / Anbaupause</span><span>Zwischenfrucht davor</span><span>Danach möglich</span><span>Max. Anbau</span></div>
            <div className="crop-groups">
              {Object.entries(categories).map(([category, label]) => {
                const group = visible.filter(crop => crop.category === category)
                if (!group.length) return null
                return <div className="crop-group" key={category}><h3>{label}<span>{group.length}</span></h3>
                  {group.map(crop => {
                    const active = selected.includes(crop.id)
                    return <div className={`crop-row${active ? ' selected' : ''}`} key={crop.id}>
                      <label className="crop-choice"><input type="checkbox" checked={active} onChange={() => change(() => setSelected(current => active ? current.filter(id => id !== crop.id) : [...current, crop.id]))} /><span><strong>{crop.name}</strong><small>Anbaupause: {crop.breakPeriods}</small></span></label>
                      <label className="cell before"><span className="mobile-label">Zwischenfrucht davor</span><select disabled={!active} aria-label={`Zwischenfrucht vor ${crop.name}`} value={policies[crop.id]} onChange={event => change(() => setPolicies(current => ({ ...current, [crop.id]: event.target.value })))}>
                        <option value={NO_CATCH}>Keine</option><option value={AUTO_CATCH}>Automatisch bei Vorteil</option><option value={REQUIRED_CATCH}>Gewünscht (beste Wahl)</option>
                        {model.catchCrops.map(catchCrop => <option key={catchCrop.id} value={catchCrop.id}>{catchCrop.name}</option>)}
                      </select></label>
                      <label className="cell after"><span className="mobile-label">Danach möglich</span><select disabled={!active} aria-label={`Zwischenfrucht nach ${crop.name}`} value={allowedAfter[crop.id] === false ? 'no' : 'yes'} onChange={event => change(() => setAllowedAfter(current => ({ ...current, [crop.id]: event.target.value === 'yes' })))}><option value="yes">Ja</option><option value="no">Nein</option></select></label>
                      <label className="cell maximum"><span className="mobile-label">Max. Anbau</span><input type="number" min={1} max={14} disabled={!active} aria-label={`Maximaler Anbau von ${crop.name}`} value={limits[crop.id] ?? 1} onChange={event => change(() => setLimits(current => ({ ...current, [crop.id]: Math.max(1, Math.min(14, Math.floor(Number(event.target.value) || 1))) })))} /></label>
                    </div>
                  })}
                </div>
              })}
              {!visible.length && <p className="empty-state">Keine Kulturen für diesen Filter gefunden.</p>}
            </div>
          </section>
          <aside>
            <section className="panel settings" aria-labelledby="settings-title"><h2 id="settings-title">Planungseinstellungen</h2>
              <label className="length-label" htmlFor="length">Länge der Fruchtfolge <strong>{length} Ernten</strong></label>
              <input id="length" type="range" min={2} max={14} value={length} onChange={event => change(() => setLength(Number(event.target.value)))} /><div className="range-labels"><span>2 Ernten</span><span>14 Ernten</span></div>
              <label className="result-limit" htmlFor="result-limit"><span>Anzahl Vorschläge<small>Wie viele Fruchtfolgen angezeigt werden</small></span><input id="result-limit" type="number" min={1} max={500} value={resultLimit} onChange={event => change(() => setResultLimit(Math.max(1, Math.min(500, Math.floor(Number(event.target.value) || 1)))))} /></label>
              <label className="fallow"><input type="checkbox" checked={fallow} onChange={event => change(() => setFallow(event.target.checked))} /><span>Brache zulassen<small>Maximal einmal pro Fruchtfolge</small></span></label>
              <dl className="summary"><div><dt>Ausgewählte Kulturen</dt><dd>{selected.length}</dd></div><div><dt>Verfügbare Anbauplätze</dt><dd>{capacity} / {length}</dd></div><div><dt>Auswertung</dt><dd>Wiederholter Zyklus</dd></div></dl>
              <button type="button" className="primary-button" disabled={capacity < length || !selected.length || pending} onClick={generate}>{pending ? 'Wird berechnet …' : 'Fruchtfolgen berechnen'}<ArrowRight size={17} /></button>
              {capacity < length && <p className="validation" role="status">Für {length} Ernten fehlen {length - capacity} Anbauplätze. Weitere Kulturen auswählen oder „Max. Anbau“ erhöhen.</p>}
              <p className="settings-note">Vorschläge werden nach dem durchschnittlichen Ertragsfaktor sortiert.</p>
            </section>
            <div className="help-note"><h3>So werden die Regeln angewendet</h3><p>Der Wunsch „davor“ gehört zur aktuellen Kultur. Ob die Zwischenfrucht möglich ist, entscheidet die unmittelbar vorherige Kultur mit „danach“.</p><p>Bei „Nein“ entfällt die Zwischenfrucht samt Ertragseffekt. Dein gespeicherter Wunsch bleibt erhalten.</p></div>
          </aside>
        </div>
      </section>
      <section id="results" className="results-section" aria-busy={pending}>
        <div className="section-heading"><div><h2>Ergebnisse <span className="count">{results.length}</span></h2><p>Durchschnittlicher Ertragsfaktor über den gesamten Zyklus. 100 % entspricht dem Basiswert.</p></div><span className={`status${dirty ? ' outdated' : ''}`} role="status">{dirty ? 'Einstellungen geändert · neu berechnen' : 'Berechnung aktuell'}</span></div>
        <div className="result-list">{results.map((result, index) => <article className="result-card" key={result.id}>
          <button className="result-summary" type="button" aria-expanded={expanded === result.id} onClick={() => setExpanded(expanded === result.id ? null : result.id)}>
            <span className="rank">{String(index + 1).padStart(2, '0')}</span><span className="sequence">{result.sequence.map((id, slot) => <span key={slot}>{slot > 0 && <ArrowRight size={13} />}<span>{displayName(id)}</span></span>)}<RotateCcw size={13} /></span><span className="result-score"><strong>{percent(result.average)}</strong><small>{percent(result.average - 1, true)} zum Basiswert</small></span><ChevronDown size={18} className={expanded === result.id ? 'expanded' : ''} />
          </button>
          {expanded === result.id && <div className="result-detail"><div className="detail-heading"><span>{result.sequence.length} Ernten · zyklische Wiederholung</span><span>Spanne: {percent(result.minimum)} – {percent(result.maximum)}</span></div><div className="table-scroll"><table><thead><tr><th>Ernte</th><th>Kultur</th><th>Vorfrucht / davor</th><th>Zwischenfrucht davor</th><th>Ertragseffekte</th><th>Faktor</th></tr></thead><tbody>{result.slots.map((slot, position) => <tr key={position}>
            <td>{position + 1}</td><td><strong>{displayName(slot.cropId)}</strong></td><td>{slot.previous.map(displayName).join(' / ')}</td><td>{slot.catchBlocked ? <span className="blocked">Nicht möglich<small>Nach {displayName(slot.previous[0])} gesperrt</small></span> : slot.score.catchCropId ? displayName(slot.score.catchCropId) : <span className="muted">Keine</span>}</td>
            <td><div className="effects">{([
              ['Vorfrucht', slot.score.predecessor], ['Anbaupause', slot.score.breakPeriod], ['Monokultur', slot.score.monoculture], ['Brache', slot.score.fallow], ['Zwischenfrucht', slot.score.catchCrop],
            ] as [string, number][]).filter(([, value]) => value !== 0).map(([label, value]) => <span className={value > 0 ? 'positive' : 'negative'} key={label}>{label} {percent(value, true)}</span>)}{slot.score.total === 1 && <span className="muted">Gesamt ±0 %</span>}</div></td><td className="factor">{percent(slot.score.total)}</td>
          </tr>)}</tbody></table></div></div>}
        </article>)}</div>
        {!results.length && <p className="empty-state">Keine passende Fruchtfolge. Bitte Auswahl und Anbaugrenzen prüfen.</p>}
      </section>
      <section id="methodology" className="method-section"><details><summary><Info size={17} /><h2>Berechnungsgrundlage</h2><ChevronDown size={17} /></summary><div className="method-content"><p>Die Bewertung verwendet die Pflanzen- und Ertragsparameter des FS25 Crop Rotation Mods. Jede Ernte berücksichtigt die letzten zwei Hauptkulturen, Anbaupausen, Monokultur, Brache und die tatsächlich mögliche Zwischenfrucht.</p><p>Die Fruchtfolge wird zyklisch bewertet: Die letzte Kultur ist die Vorfrucht der ersten. Eine gesperrte Zwischenfrucht nach der letzten Kultur gilt daher auch vor der ersten.</p><p>Die Ertragseffekte werden zum Basiswert von 100 % addiert. Bei großen Suchräumen verwendet die Berechnung eine begrenzte Suche; die Vorschläge sind dann keine Garantie für das globale Optimum.</p><p className="muted">Datenquelle: xmls/crops.xml und xmls/cropRotation.xml · Anbaupausen von 2–4 greifen wegen der zwei gespeicherten Vorfrüchte identisch.</p></div></details></section>
    </main>
    <footer><span>FS25 Crop Rotation · Fruchtfolgeplaner</span><span><Check size={13} /> Lokale Berechnung</span></footer>
  </div>
}
export default App
