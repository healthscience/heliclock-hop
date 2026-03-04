import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LocationHop } from '../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Point to the existing database in the location-hop agent folder for testing
const DB_PATH = path.join(__dirname, '../../agents/location-hop/cities.db');

describe('LocationHop', () => {
    let hopper;

    beforeAll(async () => {
        hopper = new LocationHop(DB_PATH);
        await hopper.init();
    });

    afterAll(() => {
        hopper.close();
    });

    it('should search for a specific city and return GPS coordinates', () => {
        const query = 'Torphins';
        const results = hopper.search(query);
        
        expect(results.length).toBeGreaterThan(0);
        const city = results[0];
        expect(city.name).toBe('Torphins');
        expect(city.latitude).toBeDefined();
        expect(city.longitude).toBeDefined();
        expect(city.country_code).toBe('GB');
    });

    it('should convert a timestamp to HeliClock coordinates', () => {
        const lat = 57.104;
        const lon = -2.624;
        const now = 1772619579201; // Fixed timestamp for deterministic test
        
        const heliTime = hopper.convertToHeliTime(now, lat, lon);
        
        expect(heliTime).toHaveProperty('orbital');
        expect(heliTime).toHaveProperty('zenith');
        expect(typeof heliTime.orbital).toBe('number');
        expect(typeof heliTime.zenith).toBe('number');
        
        // Check specific values for the fixed timestamp
        expect(heliTime.orbital).toBeCloseTo(343.848, 2);
        expect(heliTime.zenith).toBeCloseTo(66.75, 1);
    });

    it('should return empty array for non-existent location', () => {
        const results = hopper.search('NonExistentCityXYZ123');
        expect(results).toEqual([]);
    });
});
