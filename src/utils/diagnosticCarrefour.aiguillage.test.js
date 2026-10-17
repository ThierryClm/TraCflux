import { describe, it, expect } from 'vitest';
import { lignesDiagnostic } from './diagnosticCarrefour';

// GF10 du carrefour exemple (plan PF_Aiguillage) : vert 31 → 39, seconde
// lucarne « si absence bus B9 » 16 → 24, cycle 46 s, 200 UVP/h.
const groupe = (phaseFlag) => ({
    id: 10, name: 'Rue GISSANT sud', type: 'VL', laneCoef: 1, phaseFlag,
    offset: 31, minGreen: 5, durations: { green: 8, yellow: 3, red: 2 }
});
const actionData = [{ id: 12, gf: 10, action: 'Seconde lucarne', deb: 16, fin: 24 }];
const ligne = (phaseFlag) => lignesDiagnostic({
    groups: [groupe(phaseFlag)], cycleLength: 46, actionData,
    getTrafficData: () => ({ trafficVol: 200 })
})[0];

describe('diagnosticCarrefour — aiguillage', () => {
    it('la capacité d\'un groupe en aiguillage ne cumule pas sa seconde lucarne', () => {
        const sansAiguillage = ligne('');
        const aiguillage = ligne('a');
        // Capacité offerte proportionnelle au vert : 8 s au lieu de 16 s.
        expect(aiguillage.capacity).toBeCloseTo(sansAiguillage.capacity / 2, 5);
        expect(aiguillage.capU).toBeGreaterThan(sansAiguillage.capU);
    });
});
