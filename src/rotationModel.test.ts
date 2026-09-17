import { describe, expect, it } from 'vitest'
import {
  FALLOW_ID,
  REQUIRED_CATCH,
  evaluateRotation,
  optimizeRotations,
  scoreCrop,
} from './rotationModel'

describe('FS25 crop rotation model', () => {
  it('reproduces the 140% maize regression case', () => {
    expect(scoreCrop('MAIZE', ['CLOVER', 'CLOVER'], REQUIRED_CATCH).total).toBeCloseTo(1.4)
  })

  it('reproduces the 20% canola regression case', () => {
    expect(scoreCrop('CANOLA', ['CANOLA', 'CANOLA'], 'MUSTARD').total).toBeCloseTo(0.2)
  })

  it('stacks two fallow bonuses', () => {
    expect(scoreCrop('WHEAT', [FALLOW_ID, FALLOW_ID]).fallow).toBeCloseTo(0.1)
  })

  it('preserves the winter barley and buckwheat overlap', () => {
    expect(scoreCrop('WINTERBARLEY', ['BUCKWHEAT', 'WHEAT']).predecessor).toBeCloseTo(-0.1)
    expect(scoreCrop('WINTERBARLEY', ['WHEAT', 'BUCKWHEAT']).predecessor).toBeCloseTo(-0.05)
  })

  it('wraps both predecessors in a cyclic rotation', () => {
    const result = evaluateRotation(['CLOVER', 'CLOVER', 'MAIZE'], {})
    expect(result.slots[0].previous).toEqual(['MAIZE', 'CLOVER'])
    expect(result.slots[2].previous).toEqual(['CLOVER', 'CLOVER'])
  })

  it('returns ten unique, ranked cyclic rotations', () => {
    const results = optimizeRotations(
      ['WHEAT', 'BARLEY', 'SOYBEAN', 'CLOVER', 'MAIZE', 'CANOLA'],
      6,
      {},
    )
    expect(results).toHaveLength(10)
    expect(new Set(results.map((result) => result.id)).size).toBe(10)
    expect(results.every((result, index) => index === 0 || results[index - 1].average >= result.average)).toBe(true)
  })

  it('enforces per-crop maximum appearances', () => {
    const limits = { WHEAT: 2, BARLEY: 1, MAIZE: 1 }
    const results = optimizeRotations(['WHEAT', 'BARLEY', 'MAIZE'], 4, {}, limits)
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((result) => result.sequence.filter((crop) => crop === 'WHEAT').length <= 2)).toBe(true)
    expect(results.every((result) => result.sequence.filter((crop) => crop === 'BARLEY').length <= 1)).toBe(true)
    expect(results.every((result) => result.sequence.filter((crop) => crop === 'MAIZE').length <= 1)).toBe(true)
  })

  it('rejects rotations longer than configured capacity', () => {
    expect(optimizeRotations(['WHEAT', 'BARLEY'], 3, {}, { WHEAT: 1, BARLEY: 1 })).toEqual([])
  })
})

describe('catch crop availability after the predecessor', () => {
  it.each(['AUTO', REQUIRED_CATCH, 'OILSEEDRADISH'])('overrides %s and removes its yield effect', policy => {
    const sequence = ['CLOVER', 'MAIZE', 'WHEAT']
    const policies = { MAIZE: policy }
    const allowed = evaluateRotation(sequence, policies)
    const blocked = evaluateRotation(sequence, policies, { CLOVER: false })
    expect(allowed.slots[1].score.catchCrop).toBeCloseTo(0.15)
    expect(blocked.slots[1].catchBlocked).toBe(true)
    expect(blocked.slots[1].score.catchCropId).toBeNull()
    expect(blocked.slots[1].score.catchCrop).toBe(0)
    expect(allowed.average - blocked.average).toBeCloseTo(0.15 / 3)
    expect(policies.MAIZE).toBe(policy)
  })

  it('applies the restriction across the cycle boundary', () => {
    const result = evaluateRotation(['MAIZE', 'WHEAT', 'CLOVER'], { MAIZE: REQUIRED_CATCH }, { CLOVER: false })
    expect(result.slots[0].catchBlocked).toBe(true)
    expect(result.slots[0].score.catchCropId).toBeNull()
  })

  it('checks only the immediate predecessor and preserves allowed choices', () => {
    const result = evaluateRotation(['CLOVER', 'WHEAT', 'MAIZE'], { MAIZE: REQUIRED_CATCH }, { CLOVER: false, WHEAT: true, MAIZE: false })
    expect(result.slots[2].catchBlocked).toBe(false)
    expect(result.slots[2].score.catchCrop).toBeCloseTo(0.15)
    expect(result.slots[1].catchBlocked).toBe(false)
  })

  it('does not add a catch crop before fallow', () => {
    const result = evaluateRotation(['MAIZE', FALLOW_ID], { [FALLOW_ID]: REQUIRED_CATCH }, { MAIZE: false })
    expect(result.slots[1].score.catchCropId).toBeNull()
    expect(result.slots[1].catchBlocked).toBe(false)
  })

  it.each([3, 9])('uses restrictions in optimizer results for %i crops', count => {
    const ids = ['MAIZE', 'WHEAT', 'CLOVER', 'BARLEY', 'CANOLA', 'OAT', 'SOYBEAN', 'POTATO', 'RYE'].slice(0, count)
    const policies = Object.fromEntries(ids.map(id => [id, REQUIRED_CATCH]))
    const restrictions = Object.fromEntries(ids.map(id => [id, false]))
    // 9^6 exceeds the exhaustive threshold, exercising beam search too.
    const results = optimizeRotations(ids, Math.min(count, 6), policies, {}, 10, restrictions)
    expect(results.length).toBeGreaterThan(0)
    for (const result of results) {
      expect(result.slots.every(slot => slot.catchBlocked && slot.score.catchCropId === null)).toBe(true)
      expect(result.average).toBeCloseTo(evaluateRotation(result.sequence, {}).average)
    }
  })
})
