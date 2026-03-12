import EventEmitter from 'events'
import initHeliCore, { HeliCore } from './heli_engine.js';
import { searchCities, close as closeDb } from 'location-hop';

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
            await initHeliCore();
            this.heliCoreInitialized = true;
        }
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
    calculateSolarAge(genesisSignature, currentHeliState) {
        // 1. Full Orbits (Completed Circles)
        // This comes from your 'Orbits Completed' counter + the transition of the sun
        const baselineOrbits = genesisSignature.orbits; 

        // 2. The Fractional Orbit (The current slice of the circle)
        // genesisSignature.orbital: The degree you were born at (e.g., 90°)
        // currentHeliState.yearly: The degree the sun is at now (e.g., 350°)
        
        let degreeDiff = currentHeliState.yearly - genesisSignature.orbital;
        
        // If the sun has passed the anchor this year, the diff is positive.
        // If it hasn't reached it yet, it's negative, so we add 360 to get the 'arc traveled'.
        if (degreeDiff < 0) {
            degreeDiff += 360;
        }

        const fractionalOrbit = degreeDiff / 360;

        // 3. The Result
        // This is the actual physical displacement of the Earth since your Genesis.
        const solarAge = baselineOrbits + fractionalOrbit;
        
        return {
            whole: Math.floor(solarAge),
            decimal: (solarAge % 1).toFixed(6).split('.')[1],
            total: solarAge.toFixed(6)
        };
    }

    /**
     * Start the solar heartbeat
     * @param {Object} signature - The data from Hyperbee (lat, lon, orbital, orbits)
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
        // 1. Check for hydration
        if (!this.lat || !this.lon) {
            console.warn("Heli Heartbeat: Waiting for Lat/Lon hydration...");
            return; 
        }

        const ts = BigInt(Date.now());
        // 2. Ensure numbers are clean
        const lat = parseFloat(this.lat);
        const lon = parseFloat(this.lon);

        const currentOrbital = HeliCore.get_orbital_degree(ts);
        const currentDaily = HeliCore.get_zenith_angle(this.lat, this.lon, ts);

        // Calculate Solar Age to 4 decimal places
        // How many degrees have we moved since the birth orbital?
        /*const degreesSinceBirth = (currentOrbital - this.birthOrbital + 360) % 360;
        const currentLapProgress = degreesSinceBirth / 360;
        const solarAge = (this.baseOrbits + currentLapProgress).toFixed(4);*/
        // Calculate age based on Geometry, not "Old World" milliseconds
        const solarAge = this.calculateSolarAge({ orbits: this.baseOrbits, orbital: this.birthOrbital}, { 
            yearly: currentOrbital, 
            daily: currentDaily 
        });
        // This is for "Clock Position" (SVG Rotate)
        const rotation = this.calculateDailyRotation(ts, lon);

        // 1 Degree Pulse Check (Daily Cycle)
        const currentDegreeFloor = Math.floor(currentDaily);
        if (currentDegreeFloor !== this.lastH) {
            this.lastH = currentDegreeFloor;
            
            this.emit('HELI_DEGREE_PULSE', {
                age: solarAge,
                yearly: currentOrbital,
                daily: rotation,
                zenith: currentDaily,
                isWedgePulse: true
            });
        }
    }

    /**
     * orib maths
    */
    calculateDailyRotation(ts, lon) {
    const date = new Date(Number(ts));
    
    // 1. Get UTC hours, minutes, seconds as a decimal
    const utcHours = date.getUTCHours() + 
                     date.getUTCMinutes() / 60 + 
                     date.getUTCSeconds() / 3600;

    // 2. Adjust for Longitude (Aboyne is ~2.8° West, so -2.8)
    // Every 1 degree of longitude is 4 minutes of time
    const localSolarTime = (utcHours + (lon / 15) + 24) % 24;

    // 3. Map 24 hours to 360 degrees
    // We want 12:00 (Noon) to be 180° (Bottom) or 0° (Top) 
    // depending on your SVG orientation.
    let rotation = (localSolarTime / 24) * 360;

    return rotation; // This will be ~237° right now
}

    /**
     * Close database connection
     */
    close() {
        closeDb();
    }
}

export default HeliLocation;
