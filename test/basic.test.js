import init, { HeliCore } from '../src/heli_engine.js'
import assert from 'assert'

describe('HeliClock', () => {
  it('should initialize and calculate orbital degree', async () => {
    await init()
    const now = BigInt(Date.now())
    const degree = HeliCore.get_orbital_degree(now)
    console.log('Orbital Degree:', degree)
    assert.ok(typeof degree === 'number')
  })
})
