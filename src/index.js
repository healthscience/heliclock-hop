import initHeliCore, { HeliCore } from './heli_engine.js';
import { searchCities, close as closeDb } from 'location-hop';

export class LocationHop {
    constructor() {
        this.heliCoreInitialized = false;
    }

    /**
     * Initialize the LocationHop engine
     * Initializes HeliCore WASM
     */
    async init() {
        if (!this.heliCoreInitialized) {
            await initHeliCore();
            this.heliCoreInitialized = true;
        }
    }

    /**
     * Search for a location by text using the location-hop package
     * @param {string} query - Search term (e.g., "Torphins")
     * @param {number} limit - Max results
     * @returns {Array} - Matching locations with GPS coordinates
     */
    search(query, limit = 10) {
        return searchCities(query, limit);
    }

    /**
     * Convert a standard timestamp to HeliClock coordinates
     * @param {number|bigint} timestamp - Unix timestamp in milliseconds
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {Object} - Orbital degree and Zenith angle
     */
    convertToHeliTime(timestamp, lat, lon) {
        if (!this.heliCoreInitialized) throw new Error('HeliCore not initialized. Call init() first.');

        const ts = BigInt(timestamp);
        const orbital = HeliCore.get_orbital_degree(ts);
        const zenith = HeliCore.get_zenith_angle(lat, lon, ts);

        return {
            orbital,
            zenith,
            timestamp: ts.toString()
        };
    }

    /**
     * Close database connection
     */
    close() {
        closeDb();
    }
}
