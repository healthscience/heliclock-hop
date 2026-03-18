import EventEmitter from 'events'
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initHeliCore, { HeliCore } from './heli_clock.js';
import { searchCities, close as closeDb } from 'location-hop';

// THE PHYSICAL TRUTH CONSTANTS
const NETWORK_GENESIS_MS = 1774017960000n; // March 20, 2026, 14:46:00 UTC
const NETWORK_LONGITUDE = -41.5;           // Atlantic Prime Meridian
const MS_PER_YEAR = 31556952000;           // Tropical Year duration

class HeliLocation extends EventEmitter  {
    constructor() {
        super()
        this.heliCoreInitialized = false;
        this.lastH = -1;
        this.lat = 0;
        this.lon = 0;
    }

    /**
     * Initialize the LocationHop engine
     * Initializes HeliCore WASM
     */
    async init() {
      if (!this.heliCoreInitialized) {
        // 1. Get the actual path to the .wasm file
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const wasmPath = path.join(__dirname, 'heli_clock_bg.wasm');

        // 2. Read the file as a buffer (The "Pure" local-first way)
        const wasmBuffer = await fs.readFile(wasmPath);

        // 3. Initialize by passing the buffer directly 
        // This stops the engine from trying to use 'fetch'
        await initHeliCore(wasmBuffer);

        this.heliCoreInitialized = true;
      }
    }

    /**
     * THE HELI-STAMP (New World Coordinate)
     * Generates a coordinate relative to the 2026 Spring Equinox.
     * Use this for all Peer-to-Peer contracts and shared Besearch cycles.
     */
    getHeliStamp(internalMs) {
        const ts = BigInt(internalMs);
        
        // 1. Network Orbital Progress (The "Year" count since Equinox)
        // If before 2026, this will be negative, which is fine for the spiral.
        const elapsed = Number(ts - NETWORK_GENESIS_MS);
        const networkYear = elapsed / MS_PER_YEAR;

        // 2. Network Solar Arc (The "Day" fraction)
        // Calculated relative to the Atlantic Truth Longitude
        const networkArc = this.calculateDailyRotation(ts, NETWORK_LONGITUDE) / 360;

        return {
            age: networkYear.toFixed(9), // Public Network Age
            arc: networkArc.toFixed(4),  // Shared Geometric position
            stamp: `net.${networkYear.toFixed(9)}`
        };
    }

    /**
     * Internal Peer Age (Private)
     * Calculated from your personal Genesis Signature.
     */
    calculateSolarAge(genesisSignature, currentOrbital) {
        let degreeDiff = currentOrbital - genesisSignature.orbital;
        if (degreeDiff < 0) degreeDiff += 360;

        const fractionalOrbit = degreeDiff / 360;
        const solarAge = genesisSignature.orbits + fractionalOrbit;
        
        return {
            total: solarAge.toFixed(9),
            whole: Math.floor(solarAge),
            fraction: (solarAge % 1).toFixed(4).split('.')[1]
        };
    }

    /**
     * 
     * set the default clock
    */
    setDefaultClock(peerClock) {
      this.lat = peerClock.lat
      this.lon = peerClock.lon
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
     * Get the raw HeliCore engine if needed for low-level operations
     * @returns {HeliCore}
     */
    getEngine() {
        if (!this.heliCoreInitialized) throw new Error('HeliCore not initialized. Call init() first.');
        return HeliCore;
    }

    /*
    / @method getHeliSignature
    /
    **/
    getHeliSignature(sliderOrbital, sliderDaily, orbits, lat, lon) {
        const sOrbital = parseFloat(sliderOrbital) || 0;
        const sDaily = parseFloat(sliderDaily) || 0;
        const sOrbits = parseInt(orbits) || 0;
        const sLat = parseFloat(lat) || 0;
        const sLon = parseFloat(lon) || 0;

        // 1. Get the 1973 Date from binary search
        const birthDayDate = this.getOldWorldFromHeli(sOrbital, sOrbits);

        // 2. IMPORTANT: Create a NEW date based on the Year/Month/Day found
        // This prevents any "Current Time" leakage
        const year = birthDayDate.getFullYear();
        const month = birthDayDate.getMonth();
        const day = birthDayDate.getDate();

        // 3. Map 0-360 daily slider to 0-24 hours
        const totalMinutesInDay = (sDaily / 360) * 1440;
        const hours = Math.floor(totalMinutesInDay / 60);
        const minutes = Math.floor(totalMinutesInDay % 60);

        // 4. Construct the Final Date strictly
        const finalDate = new Date(year, month, day, hours, minutes, 0);

        // Now pass this 1973 timestamp to get the Zenith
        return this.convertToHeliTime(finalDate.getTime(), sLat, sLon);
    }

    /**
     * old world converter
     * @param {*} timestamp 
     * @param {*} lat 
     * @param {*} lon 
     * @returns 
     */
    convertToHeliTime(timestamp, lat, lon) {
        if (!this.heliCoreInitialized) throw new Error('HeliCore not initialized.');

        // Final safety check before BigInt conversion
        const tsNum = Number(timestamp);
        if (isNaN(tsNum)) {
            console.warn('Heli: Received NaN timestamp, defaulting to Now');
            return this.convertToHeliTime(Date.now(), lat, lon);
        }

        const ts = BigInt(Math.floor(tsNum)); // Ensure it's a floored integer
        const orbital = HeliCore.get_orbital_degree(ts);
        const zenith = HeliCore.get_zenith_angle(lat, lon, ts);

        return {
            orbital,
            zenith,
            timestamp: ts.toString()
        };
    }

    /**
     * Translates the Heli Slider (Angle) into an Old World Date/Time.
     * @param {number} sliderAngle - 0 to 360 degrees
     * @param {number} orbits - Number of years completed
     * @param {number} lat - Birth Latitude
     * @param {number} lon - Birth Longitude
     * @returns {Date} - The translated Old World timestamp
     */
    getOldWorldFromHeli(sliderAngle, orbits) {
        if (!this.heliCoreInitialized) throw new Error('HeliCore not initialized.');

        // 1. Calculate the Birth Year (2026 - 52 - 1 = 1973)
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - parseInt(orbits) - 1;

        // 2. Set search boundaries for that specific year
        let startTs = new Date(birthYear, 0, 1).getTime();
        let endTs = new Date(birthYear, 11, 31, 23, 59, 59).getTime();

        // 3. Binary Search: Narrow down the millisecond
        let midTs = startTs;
        for (let i = 0; i < 32; i++) {
            midTs = (startTs + endTs) / 2;
            // Query the WASM Master Clock
            const currentDegree = HeliCore.get_orbital_degree(BigInt(Math.floor(midTs)));
            
            if (currentDegree < sliderAngle) {
                startTs = midTs;
            } else {
                endTs = midTs;
            }
        }

        // 4. Return the 1973 Date object
        return new Date(Math.floor(midTs));
    }
    
    /*
    *  Calculate age from gensis signature
    */
    activateSolarHeartbeat(signature) {
        this.lat = signature.location.lat;
        this.lon = signature.location.long;
        this.birthOrbital = signature.orbital; // The degree when they were born
        this.baseOrbits = signature.orbits;    // The "Laps" completed at setup
        this.emit('HELI_DEGREE_SIGNATURE', {
            location: signature.location,
            birthorbital: this.birthOrbital,
            sun: signature.daily,
            signed: true
        });
        // one on start
        this.updateHeliState();
        // Start the pulse: Check every 5 seconds (sufficient for degree changes)
        if (this.pulseInterval) clearInterval(this.pulseInterval);
        this.pulseInterval = setInterval(() => {
            this.updateHeliState();
        }, 5000); 
    }

    updateHeliState() {
        if (!this.lat || !this.lon) return;

        const ts = BigInt(Date.now());
        const currentOrbital = HeliCore.get_orbital_degree(ts);
        const currentZenith = HeliCore.get_zenith_angle(this.lat, this.lon, ts);

        // 1. PRIVATE: My Biological Age
        const myAge = this.calculateSolarAge(
            { orbits: this.baseOrbits, orbital: this.birthOrbital }, 
            currentOrbital
        );

        // 2. PUBLIC: The Network HeliStamp (2026 Equinox Anchor)
        const netStamp = this.getHeliStamp(ts);

        // 3. GEOMETRY: The SVG Rotation for the clock face
        const rotation = this.calculateDailyRotation(ts, this.lon);

        const currentDegreeFloor = Math.floor(currentZenith);
        if (currentDegreeFloor !== this.lastH) {
            this.lastH = currentDegreeFloor;
            
            this.emit('HELI_DEGREE_PULSE', {
                age: myAge,       // For internal logs
                heliStamp: netStamp.age,  // For Peer Contracts
                yearly: currentOrbital,
                daily: rotation,
                zenith: currentZenith,
                isWedgePulse: true
            });
        }
    }

    calculateDailyRotation(ts, lon) {
        const date = new Date(Number(ts));
        const utcHours = date.getUTCHours() + 
                         date.getUTCMinutes() / 60 + 
                         date.getUTCSeconds() / 3600;

        // Solar time adjusted for the "Location of Truth" (Longitude)
        const localSolarTime = (utcHours + (lon / 15) + 24) % 24;
        return (localSolarTime / 24) * 360;
    }

    /**
     * orib maths
    */
    calculateDailyRotation(ts, lon) {
        const date = new Date(Number(ts));
        const utcHours = date.getUTCHours() + 
                         date.getUTCMinutes() / 60 + 
                         date.getUTCSeconds() / 3600;

        // Solar time adjusted for the "Location of Truth" (Longitude)
        const localSolarTime = (utcHours + (lon / 15) + 24) % 24;
        return (localSolarTime / 24) * 360;
    }

    /**
     * Close database connection
     */
    close() {
        closeDb();
    }
}

export default HeliLocation;