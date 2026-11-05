import { it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrafficLight } from './useTrafficLight';
import { parseDiagfeux } from '../utils/diagfeuxImporter';

beforeEach(() => localStorage.clear());
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
// Fichier inventé : deux plans de fonctionnement et deux trafics liés.
const phase = (duration, id) => `<Phase><Durée>${duration}</Durée><IDLigneFeux>${id}</IDLigneFeux></Phase>`;
const plan = (id, name, a, b, extra = '') => `<PlanFeux ID="${id}" IDTrafic="${id === 'S1' ? 0 : 1}" ${id === 'S2' ? 'Définitif="true"' : ''}>${name ? `<NomFonctionnement>${name}</NomFonctionnement>` : ''}${phase(a, 'A')}${phase(b, 'B')}${extra}</PlanFeux>`;
const xml = `<DataSetDiagfeux><Paramétrage Version="3"/><Carrefour><Propriétés><Nom>Import fictif</Nom><EnAgglo>true</EnAgglo></Propriétés><Variante><ModeGraphique>true</ModeGraphique>
<Branche/><Branche/>
<LigneDeFeux><ID>A</ID><Signal strCode="R11"/><RougeDégagement IDAdverse="B">4</RougeDégagement></LigneDeFeux>
<LigneDeFeux><ID>B</ID><Signal strCode="R12"/><RougeDégagement IDAdverse="A">6</RougeDégagement></LigneDeFeux>
<Trajectoire IDLigneDeFeux="A"><Véhicules><VoieOrigine>0</VoieOrigine><VoieDestination>8</VoieDestination></Véhicules></Trajectoire>
<Trafic><Nom>Matin</Nom><UVP>true</UVP><QVéhicule>0</QVéhicule><QVéhicule>150</QVéhicule><QVéhicule>0</QVéhicule><QVéhicule>0</QVéhicule></Trafic>
<Trafic><Nom>Soir</Nom><UVP>true</UVP><QVéhicule>0</QVéhicule><QVéhicule>300</QVéhicule><QVéhicule>0</QVéhicule><QVéhicule>0</QVéhicule></Trafic>
${plan('S1', '', 15, 15)}${plan('S1', 'Pointe matin', 45, 35)}${plan('S2', '', 15, 15)}${plan('S2', 'Pointe soir', 60, 48)}
</Variante></Carrefour></DataSetDiagfeux>`;

it('charge, change de PF et recharge un import sans perdre cycles, matrices, signaux ou trafics', async () => {
    const parsed = parseDiagfeux(xml);
    expect(parsed.error).toBeUndefined();
    const { result } = renderHook(() => useTrafficLight());
    await act(async () => { await pause(2200); });
    await act(async () => result.current.loadFullState(parsed.state));
    await act(async () => { await pause(250); });
    expect(result.current.activePFId).toBe(2);
    expect(result.current.cycleLength).toBe(108);
    expect(result.current.groups.map(g => [g.offset, g.durations.green])).toEqual([[0, 53], [60, 42]]);
    expect(result.current.groups.map(g => g.signal)).toEqual(['R11v', 'R12']);
    expect(result.current.activeTrafficDataset).toBe('Soir');
    expect(result.current.getTrafficData(1).trafficVol).toBe(300);
    await act(async () => result.current.setActivePFId(1));
    await act(async () => { await pause(200); });
    expect(result.current.cycleLength).toBe(80);
    expect(result.current.groups.map(g => [g.offset, g.durations.green])).toEqual([[0, 38], [45, 29]]);
    expect(result.current.getTrafficData(1).trafficVol).toBe(150);
    expect(result.current.conflictMatrix).toEqual([['', 7], [6, '']]);
    const saved = JSON.parse(JSON.stringify(result.current.getFullState()));
    expect(saved.pfTabs.map(p => p.cycleLength)).toEqual([80, 108]);
    await act(async () => result.current.loadFullState(saved));
    await act(async () => { await pause(200); });
    await act(async () => result.current.setActivePFId(2));
    await act(async () => { await pause(200); });
    expect(result.current.cycleLength).toBe(108);
    expect(result.current.groups[0].durations.green).toBe(53);
    expect(result.current.getTrafficData(1).trafficVol).toBe(300);
    expect(result.current.pfTabs.map(p => p.cycleLength)).toEqual([80, 108]);
});
