import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import init, { HeliCore } from '../src/heli_clock.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('HeliClock', () => {
  it('should initialize and calculate orbital degree', async () => {
    const wasmPath = path.join(__dirname, '../src/heli_clock_bg.wasm');
    const wasmBuffer = fs.readFileSync(wasmPath);
    await init(wasmBuffer);
    const now = BigInt(Date.now());
    const degree = HeliCore.get_orbital_degree(now);
    console.log('Orbital Degree:', degree);
    expect(typeof degree).toBe('number');
  });
});
