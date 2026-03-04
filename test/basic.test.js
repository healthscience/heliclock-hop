import { describe, it, expect } from 'vitest';
import init, { HeliCore } from '../src/heli_engine.js';

describe('HeliClock', () => {
  it('should initialize and calculate orbital degree', async () => {
    await init();
    const now = BigInt(Date.now());
    const degree = HeliCore.get_orbital_degree(now);
    console.log('Orbital Degree:', degree);
    expect(typeof degree).toBe('number');
  });
});
