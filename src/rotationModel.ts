import cropsXml from '../../xmls/crops.xml?raw'
import settingsXml from '../../xmls/cropRotation.xml?raw'

export const FALLOW_ID = 'FALLOW'
export const AUTO_CATCH = 'AUTO'
export const REQUIRED_CATCH = 'REQUIRED'
export const NO_CATCH = 'NONE'

export type Category =
  | 'Grain'
  | 'Legume'
  | 'Oil & industrial'
  | 'Root & vegetable'
  | 'Grass & forage'
  | 'Specialty'

export interface CropDefinition {
  id: string
  name: string
  category: Category
  breakPeriods: number
  veryGood: string[]
  good: string[]
  bad: string[]
  ignoreInPlanner: boolean
  ignoreFallow: boolean
}

export interface CatchCropDefinition {
  id: string
  name: string
  veryGood: string[]
  good: string[]
  bad: string[]
}

export interface Coefficients {
  monoculture: number
  breakPeriod: number
  predecessorBad: [number, number]
  predecessorVeryGood: [number, number]
  predecessorGood: [number, number]
  fallow: number
  catchVeryGood: number
  catchGood: number
  catchBad: number
  maxFallowState: number
}

export interface CatchChoice {
  id: string | null
  effect: number
}

export interface ScoreBreakdown {
  total: number
  base: number
  monoculture: number
  breakPeriod: number
  predecessor: number
  fallow: number
  catchCrop: number
  catchCropId: string | null
}

export interface RotationSlot {
  cropId: string
  score: ScoreBreakdown
  previous: [string, string]
  catchBlocked: boolean
}

export interface RotationResult {
  id: string
  sequence: string[]
  slots: RotationSlot[]
  average: number
  minimum: number
  maximum: number
}

const names: Record<string, string> = {
  FALLOW: 'Brache', MEADOW: 'Wiese', GRASS: 'Gras', FIELDGRASS: 'Feldgras',
  WHEAT: 'Weizen', WINTERWHEAT: 'Winterweizen', SUMMERWHEAT: 'Sommerweizen',
  BARLEY: 'Gerste', SUMMERBARLEY: 'Sommergerste', WINTERBARLEY: 'Wintergerste',
  OAT: 'Hafer', RYE: 'Roggen', TRITICALE: 'Triticale', BUCKWHEAT: 'Buchweizen', SPELT: 'Dinkel',
  GREENRYE: 'Grünroggen', VETCHRYE: 'Wickroggen', SORGHUM: 'Sorghum',
  SOYBEAN: 'Sojabohnen', GREENBEAN: 'Grüne Bohnen', PEA: 'Erbse', PEAS: 'Erbsen', BEANS: 'Bohnen', LENTILS: 'Linsen',
  MAIZE: 'Mais', SILAGEMAIZE: 'Silomais', CANOLA: 'Raps', SUNFLOWER: 'Sonnenblumen',
  LINSEED: 'Leinsamen', HEMP: 'Hanf', POPPY: 'Mohn', TOBACCO: 'Tabak', LAVENDER: 'Lavendel',
  POTATO: 'Kartoffeln', SUGARBEET: 'Zuckerrüben', ONION: 'Zwiebeln', BEETROOT: 'Rote Bete',
  CARROT: 'Karotten', PARSNIP: 'Pastinaken', SPINACH: 'Spinat',
  CLOVER: 'Klee', ALFALFA: 'Luzerne', RICE: 'Reis', RICELONGGRAIN: 'Langkornreis',
  SUGARCANE: 'Zuckerrohr', COTTON: 'Baumwolle', GRAPE: 'Trauben', OLIVE: 'Oliven', POPLAR: 'Pappeln',
  OILSEEDRADISH: 'Ölrettich', HUMUSACTIVE: 'Humusaktiv', MUSTARD: 'Senf', FLOWERINGCATCHCROP: 'Blühende Zwischenfrucht',
}

export function displayName(id: string): string {
  return names[id] ?? id.charAt(0) + id.slice(1).toLowerCase()
}

const categoryIds: Record<Category, Set<string>> = {
  'Grass & forage': new Set(['MEADOW', 'GRASS', 'FIELDGRASS', 'ALFALFA', 'CLOVER']),
  Grain: new Set([
    'WHEAT', 'WINTERWHEAT', 'SUMMERWHEAT', 'BARLEY', 'SUMMERBARLEY',
    'WINTERBARLEY', 'OAT', 'RYE', 'TRITICALE', 'BUCKWHEAT', 'SPELT',
    'GREENRYE', 'SORGHUM', 'VETCHRYE',
  ]),
  Legume: new Set(['SOYBEAN', 'GREENBEAN', 'PEA', 'BEANS', 'PEAS', 'LENTILS']),
  'Oil & industrial': new Set([
    'MAIZE', 'SILAGEMAIZE', 'CANOLA', 'SUNFLOWER', 'LINSEED', 'HEMP',
    'POPPY', 'TOBACCO', 'LAVENDER', 'COTTON',
  ]),
  'Root & vegetable': new Set([
    'POTATO', 'SUGARBEET', 'ONION', 'BEETROOT', 'CARROT', 'PARSNIP', 'SPINACH',
  ]),
  Specialty: new Set(['RICE', 'RICELONGGRAIN', 'SUGARCANE', 'GRAPE', 'OLIVE', 'POPLAR']),
}

function categoryFor(id: string): Category {
  return (Object.entries(categoryIds).find(([, ids]) => ids.has(id))?.[0] as Category) ?? 'Specialty'
}

function parseAttributes(source: string): Record<string, string> {
  return Object.fromEntries(
    [...source.matchAll(/([\w]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
  )
}

function list(value = ''): string[] {
  return value.trim() ? value.trim().split(/\s+/) : []
}

function parsePair(value: string): [number, number] {
  const values = list(value).map(Number)
  return [values[0], values[1]]
}

export function parseModel(cropsSource = cropsXml, settingsSource = settingsXml) {
  const crops = [...cropsSource.matchAll(/<crop\s+([^>]+)\/>/g)].map((match) => {
    const attributes = parseAttributes(match[1])
    return {
      id: attributes.fruitName,
      name: displayName(attributes.fruitName),
      category: categoryFor(attributes.fruitName),
      breakPeriods: Number(attributes.breakPeriods),
      veryGood: list(attributes.veryGoodCrops),
      good: list(attributes.goodCrops),
      bad: list(attributes.badCrops),
      ignoreInPlanner: attributes.ignoreInPlanner === 'true',
      ignoreFallow: attributes.ignoreFallow === 'true',
    } satisfies CropDefinition
  })

  const catchCrops = [...cropsSource.matchAll(/<catchCrop\s+([^>]+)\/>/g)].map((match) => {
    const attributes = parseAttributes(match[1])
    return {
      id: attributes.fruitName,
      name: displayName(attributes.fruitName),
      veryGood: list(attributes.veryGoodCrops),
      good: list(attributes.goodCrops),
      bad: list(attributes.badCrops),
    } satisfies CatchCropDefinition
  })

  const settingsMatch = settingsSource.match(/<settings\s+([^>]+)\/>/)
  const settings = parseAttributes(settingsMatch?.[1] ?? '')
  const fallow = parseAttributes(settingsSource.match(/<fallowStateMap\s+([^>]+)\/>/)?.[1] ?? '')
  const coefficients: Coefficients = {
    monoculture: Number(settings.monoculturePenalty),
    breakPeriod: Number(settings.breakPeriodsPenalty),
    predecessorBad: parsePair(settings.foreCropsPenalties),
    predecessorVeryGood: parsePair(settings.foreCropsVeryGoodBonuses),
    predecessorGood: parsePair(settings.foreCropsGoodBonuses),
    fallow: Number(settings.fallowStateBonus),
    catchVeryGood: Number(settings.veryGoodCatchCropBonus),
    catchGood: Number(settings.goodCatchCropBonus),
    catchBad: Number(settings.badCatchCropPenalty),
    maxFallowState: Number(fallow.maxFallowState),
  }

  return { crops, catchCrops, coefficients }
}

export const model = parseModel()
export const cropById = new Map(model.crops.map((crop) => [crop.id, crop]))
export const catchCropById = new Map(model.catchCrops.map((crop) => [crop.id, crop]))

export function catchEffect(catchCropId: string, currentCropId: string): number {
  const definition = catchCropById.get(catchCropId)
  if (!definition) return 0

  // The Lua implementation assigns in this order, so bad intentionally wins overlaps.
  let effect = 0
  if (definition.veryGood.includes(currentCropId)) effect = model.coefficients.catchVeryGood
  if (definition.good.includes(currentCropId)) effect = model.coefficients.catchGood
  if (definition.bad.includes(currentCropId)) effect = model.coefficients.catchBad
  return effect
}

export function resolveCatchChoice(policy: string, currentCropId: string): CatchChoice {
  if (policy === NO_CATCH || currentCropId === FALLOW_ID) return { id: null, effect: 0 }
  if (policy !== AUTO_CATCH && policy !== REQUIRED_CATCH) {
    return { id: policy, effect: catchEffect(policy, currentCropId) }
  }

  const choices = model.catchCrops.map((crop) => ({
    id: crop.id,
    effect: catchEffect(crop.id, currentCropId),
  }))
  if (policy === AUTO_CATCH) choices.push({ id: '', effect: 0 })
  choices.sort((a, b) => b.effect - a.effect || a.id.localeCompare(b.id))
  return { id: choices[0]?.id || null, effect: choices[0]?.effect ?? 0 }
}

export function scoreCrop(
  currentCropId: string,
  history: [string, string],
  catchPolicy = NO_CATCH,
): ScoreBreakdown {
  const definition = cropById.get(currentCropId)
  if (!definition) {
    return {
      total: 1,
      base: 1,
      monoculture: 0,
      breakPeriod: 0,
      predecessor: 0,
      fallow: 0,
      catchCrop: 0,
      catchCropId: null,
    }
  }

  const coefficients = model.coefficients
  let monoculture = 0
  let breakPeriod = 0
  let predecessor = 0
  let fallow = 0

  if (definition.breakPeriods !== 0 && history.every((crop) => crop === currentCropId)) {
    monoculture += coefficients.monoculture
  }

  history.forEach((previousCropId, index) => {
    if (index < definition.breakPeriods && previousCropId === currentCropId) {
      breakPeriod += coefficients.breakPeriod
    }
    if (previousCropId === FALLOW_ID) fallow += coefficients.fallow
    if (definition.veryGood.includes(previousCropId)) predecessor += coefficients.predecessorVeryGood[index]
    if (definition.good.includes(previousCropId)) predecessor += coefficients.predecessorGood[index]
    if (definition.bad.includes(previousCropId)) predecessor += coefficients.predecessorBad[index]
  })

  const catchChoice = resolveCatchChoice(catchPolicy, currentCropId)
  const total = 1 + monoculture + breakPeriod + predecessor + fallow + catchChoice.effect
  return {
    total,
    base: 1,
    monoculture,
    breakPeriod,
    predecessor,
    fallow,
    catchCrop: catchChoice.effect,
    catchCropId: catchChoice.id,
  }
}

export function evaluateRotation(
  sequence: string[],
  catchPolicies: Record<string, string>,
  catchAllowedAfter: Record<string, boolean> = {},
): RotationResult {
  const slots = sequence.map((cropId, index) => {
    const previous: [string, string] = [
      sequence[(index - 1 + sequence.length) % sequence.length],
      sequence[(index - 2 + sequence.length) % sequence.length],
    ]
    const catchBlocked = catchAllowedAfter[previous[0]] === false &&
      (catchPolicies[cropId] ?? NO_CATCH) !== NO_CATCH && cropId !== FALLOW_ID
    return {
      cropId,
      previous,
      catchBlocked,
      score: scoreCrop(cropId, previous, catchBlocked ? NO_CATCH : catchPolicies[cropId] ?? NO_CATCH),
    }
  })
  const values = slots.map((slot) => slot.score.total)
  return {
    id: canonicalSequence(sequence),
    sequence,
    slots,
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  }
}

function canonicalSequence(sequence: string[]): string {
  const rotations = sequence.map((_, index) => [
    ...sequence.slice(index),
    ...sequence.slice(0, index),
  ].join('|'))
  return rotations.sort()[0]
}

interface Candidate {
  sequence: string[]
  heuristic: number
}

export function optimizeRotations(
  cropIds: string[],
  length: number,
  catchPolicies: Record<string, string>,
  occurrenceLimits: Record<string, number> = {},
  limit = 10,
  catchAllowedAfter: Record<string, boolean> = {},
): RotationResult[] {
  const candidates = cropIds.filter((cropId) => getOccurrenceLimit(cropId, occurrenceLimits) > 0)
  const capacity = candidates.reduce(
    (total, cropId) => total + getOccurrenceLimit(cropId, occurrenceLimits),
    0,
  )
  if (!candidates.length || length < 1 || capacity < length) return []
  if (candidates.length ** length <= 500_000) {
    return optimizeExhaustively(candidates, length, catchPolicies, occurrenceLimits, limit, catchAllowedAfter)
  }
  const beamWidth = Math.max(2500, Math.min(9000, 450 * candidates.length))
  let beam: Candidate[] = candidates.map((cropId) => ({ sequence: [cropId], heuristic: 0 }))

  for (let position = 1; position < length; position += 1) {
    const next: Candidate[] = []
    for (const candidate of beam) {
      for (const cropId of candidates) {
        const appearances = candidate.sequence.filter((id) => id === cropId).length
        if (appearances >= getOccurrenceLimit(cropId, occurrenceLimits)) continue
        const sequence = [...candidate.sequence, cropId]
        let heuristic = candidate.heuristic
        if (sequence.length >= 3) {
          const history: [string, string] = [
            sequence[sequence.length - 2],
            sequence[sequence.length - 3],
          ]
          heuristic += scoreCrop(cropId, history, catchAllowedAfter[history[0]] === false ? NO_CATCH : catchPolicies[cropId] ?? NO_CATCH).total
        }
        next.push({ sequence, heuristic })
      }
    }
    next.sort((a, b) => b.heuristic - a.heuristic)
    beam = next.slice(0, beamWidth)
  }

  const unique = new Map<string, RotationResult>()
  for (const candidate of beam) {
    const result = evaluateRotation(candidate.sequence, catchPolicies, catchAllowedAfter)
    const existing = unique.get(result.id)
    if (!existing || result.average > existing.average) unique.set(result.id, result)
  }
  return [...unique.values()]
    .sort((a, b) => b.average - a.average || b.minimum - a.minimum || a.id.localeCompare(b.id))
    .slice(0, limit)
}

function optimizeExhaustively(
  cropIds: string[],
  length: number,
  catchPolicies: Record<string, string>,
  occurrenceLimits: Record<string, number>,
  limit: number,
  catchAllowedAfter: Record<string, boolean>,
): RotationResult[] {
  const best = new Map<string, RotationResult>()
  const sequence: string[] = []

  const visit = () => {
    if (sequence.length === length) {
      const result = evaluateRotation([...sequence], catchPolicies, catchAllowedAfter)
      // Cyclic shifts are the same plan; only evaluate their canonical representation.
      if (sequence.join('|') !== result.id || best.has(result.id)) return
      best.set(result.id, result)
      if (best.size > limit * 2) {
        const ranked = [...best.values()]
          .sort((a, b) => b.average - a.average || b.minimum - a.minimum || a.id.localeCompare(b.id))
          .slice(0, limit)
        best.clear()
        ranked.forEach((rotation) => best.set(rotation.id, rotation))
      }
      return
    }

    for (const cropId of cropIds) {
      const appearances = sequence.filter((id) => id === cropId).length
      if (appearances >= getOccurrenceLimit(cropId, occurrenceLimits)) continue
      sequence.push(cropId)
      visit()
      sequence.pop()
    }
  }

  visit()
  return [...best.values()]
    .sort((a, b) => b.average - a.average || b.minimum - a.minimum || a.id.localeCompare(b.id))
    .slice(0, limit)
}

function getOccurrenceLimit(cropId: string, occurrenceLimits: Record<string, number>): number {
  return Math.max(0, Math.floor(occurrenceLimits[cropId] ?? 1))
}
