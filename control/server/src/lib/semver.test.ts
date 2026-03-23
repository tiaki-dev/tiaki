import { describe, it, expect } from 'vitest'
import { getBumpType, isBumpAllowed } from './semver.js'

describe('getBumpType', () => {
  it('detects patch bump', () => expect(getBumpType('1.29.5', '1.29.6')).toBe('patch'))
  it('detects minor bump', () => expect(getBumpType('1.28.0', '1.29.0')).toBe('minor'))
  it('detects major bump', () => expect(getBumpType('7.0.0', '8.0.0')).toBe('major'))
  it('handles alpine suffix', () => expect(getBumpType('7-alpine', '8-alpine')).toBe('major'))
  it('handles v-prefix', () => expect(getBumpType('v1.2.3', 'v1.2.4')).toBe('patch'))
  it('returns unknown for non-semver', () => expect(getBumpType('latest', 'latest')).toBe('unknown'))
  it('returns unknown for same version', () => expect(getBumpType('1.0.0', '1.0.0')).toBe('unknown'))
})

describe('isBumpAllowed', () => {
  it('allows everything when maxBump is null', () => {
    expect(isBumpAllowed('major', null)).toBe(true)
    expect(isBumpAllowed('minor', null)).toBe(true)
    expect(isBumpAllowed('patch', null)).toBe(true)
  })
  it('patch maxBump: allows patch, blocks minor+major', () => {
    expect(isBumpAllowed('patch', 'patch')).toBe(true)
    expect(isBumpAllowed('minor', 'patch')).toBe(false)
    expect(isBumpAllowed('major', 'patch')).toBe(false)
  })
  it('minor maxBump: allows patch+minor, blocks major', () => {
    expect(isBumpAllowed('patch', 'minor')).toBe(true)
    expect(isBumpAllowed('minor', 'minor')).toBe(true)
    expect(isBumpAllowed('major', 'minor')).toBe(false)
  })
  it('major maxBump: allows all', () => {
    expect(isBumpAllowed('patch', 'major')).toBe(true)
    expect(isBumpAllowed('minor', 'major')).toBe(true)
    expect(isBumpAllowed('major', 'major')).toBe(true)
  })
  it('allows unknown bumps (non-semver tags pass through)', () => {
    expect(isBumpAllowed('unknown', 'patch')).toBe(true)
  })
})
