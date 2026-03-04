import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import initHeliCore, { HeliCore } from './heli_engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class LocationHop {
    constructor(dbPath) {
        this.dbPath = dbPath || path.join(__dirname, '../cities.db');
        this.db = null;
        this.heliCoreInitialized = false;
    }

    /**
     * Initialize the LocationHop engine
     * Connects to database and initializes HeliCore WASM
     */
    async init() {
        if (!this.db) {
            // Check if database exists, if not we might need to signal for creation
            // In a real installation of bentoboxds, load_data.js should have run
            if (!fs.existsSync(this.dbPath)) {
                console.warn(`Database not found at ${this.dbPath}. Ensure load_data.js has been run.`);
            }
            this.db = new Database(this.dbPath, { readonly: true });
        }

        if (!this.heliCoreInitialized) {
            await initHeliCore();
            this.heliCoreInitialized = true;
        }
    }

    /**
     * Search for a location by text
     * @param {string} query - Search term (e.g., "Torphins")
     * @param {number} limit - Max results
     * @returns {Array} - Matching locations with GPS coordinates
     */
    search(query, limit = 10) {
        if (!this.db) throw new Error('LocationHop not initialized. Call init() first.');

        const stmt = this.db.prepare(`
            SELECT 
                c.id,
                c.name,
                c.latitude,
                c.longitude,
                c.country_code,
                c.admin1_code as region,
                c.population,
                c.timezone,
                s.rank
            FROM cities_search s
            JOIN cities c ON c.id = s.rowid
            WHERE cities_search MATCH ?
            ORDER BY rank
            LIMIT ?
        `);

        return stmt.all(query, limit);
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
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
