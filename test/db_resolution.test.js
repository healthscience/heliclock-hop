import { describe, it, expect, vi } from 'vitest';
import { getDatabasePath } from 'location-hop';
import os from 'os';
import path from 'path';
import fs from 'fs';

describe('Database Path Resolution', () => {
    it('should resolve to home directory path on Linux when cities.db exists', () => {
        // Only run this test if on Linux
        if (os.platform() !== 'win32') {
            const homedir = os.homedir();
            const expectedPath = path.join(homedir, '.hop-models', 'place', 'cities.db');
            
            // Check if it actually exists in the real environment
            if (fs.existsSync(expectedPath)) {
                const dbPath = getDatabasePath();
                expect(dbPath).toBe(expectedPath);
            }
        }
    });

    it('should construct correct Windows path structure', () => {
        // Mock os.platform and os.homedir to simulate Windows
        const platformSpy = vi.spyOn(os, 'platform').mockReturnValue('win32');
        const homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\TestUser');
        
        // We need to bypass the actual fs.existsSync check to test path construction
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

        const dbPath = getDatabasePath();
        
        // Expected: C:\Users\TestUser\hop-models\place\cities.db
        // Note: location-hop implementation uses path.join which handles separators
        expect(dbPath).toContain('hop-models');
        expect(dbPath).toContain('place');
        expect(dbPath).toContain('cities.db');
        expect(dbPath).toMatch(/C:.*Users.*TestUser.*hop-models.*place.*cities.db/);

        platformSpy.mockRestore();
        homedirSpy.mockRestore();
        existsSpy.mockRestore();
    });

    it('should fallback to local cities.db if home directory path does not exist', () => {
        // Mock fs.existsSync to return false for the home path
        const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
            if (p.includes('.hop-models') || p.includes('hop-models')) {
                return false;
            }
            return true;
        });

        const dbPath = getDatabasePath();
        
        // Should contain the local package path (ending with cities.db)
        expect(dbPath).toContain('cities.db');
        expect(dbPath).not.toContain('.hop-models');
        expect(dbPath).not.toContain('hop-models/place');

        existsSpy.mockRestore();
    });
});
