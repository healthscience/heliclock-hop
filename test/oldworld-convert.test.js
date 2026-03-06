import { describe, it, expect, beforeAll } from 'vitest';
import HeliLocation from '../src/index.js';

describe('Heli Calibration Test', () => {
    let heli;

    beforeAll(async () => {
        heli = new HeliLocation();
        await heli.init();
    });

    it('should convert old world coordinates to correct 1973 timestamp', () => {
        const testOrbits = 52;
        const testOrbital = 85.58; // June 16th
        const testDaily = 270;     // 18:00 hrs
        const lat = 57.149;        // Torphins/Aberdeen area
        const lon = -2.108;

        const result = heli.getHeliSignature(testOrbital, testDaily, testOrbits, lat, lon);
        console.log(result)
        const date = new Date(Number(result.timestamp));
        console.log('old worl ddataeeerer')
        console.log(date)
        expect(date.getFullYear()).toBe(1973);
        expect(result).toHaveProperty('zenith');
        expect(result).toHaveProperty('timestamp');
    });
});
