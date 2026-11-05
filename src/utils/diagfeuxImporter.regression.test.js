import { describe, it, expect } from 'vitest';
import { parseDiagfeux } from './diagfeuxImporter';
import { MAX_PF } from './pfHelpers';

// Données inventées pour les tests ; aucun projet réel ni schéma CEREMA copié.
const line = (id, signal = 'R11', rest = '') => `<LigneDeFeux><ID>${id}</ID><Signal strCode="${signal}"/>${rest}</LigneDeFeux>`;
const ref = (id, open = 0, close = 0) => `<IDLigneFeux DécalageOuvre="${open}" DécalageFerme="${close}">${id}</IDLigneFeux>`;
const phase = (duration, refs) => `<Phase><Durée>${duration}</Durée>${refs}</Phase>`;
const plan = (id, name, phases, rest = '', attributes = '') => `<PlanFeux ID="${id}" ${attributes}>${name ? `<NomFonctionnement>${name}</NomFonctionnement>` : ''}${phases}${rest}</PlanFeux>`;
const rd = (i, j, n) => `<RougesDégagement IdLfRouge1="${i}" IdLfRouge2="${j}">${n}</RougesDégagement>`;
const wrap = (body, props = '', attributes = '', version = 3) => `<?xml version="1.0"?><DataSetDiagfeux xmlns="http://cete.fr/namespace"><Paramétrage Version="${version}"/><Carrefour><Propriétés><Nom>Carrefour fictif</Nom><EnAgglo>true</EnAgglo>${props}</Propriétés><Variante ${attributes}>${body}</Variante></Carrefour></DataSetDiagfeux>`;
const twoLines = line('A') + line('B');
const phases = (a = 30, b = 20) => phase(a, ref('A')) + phase(b, ref('B'));
const matrix = rd('A', 'A', 0) + rd('A', 'B', 4) + rd('B', 'A', 6) + rd('B', 'B', 0);
const get = xml => {
    const result = parseDiagfeux(xml);
    expect(result.error).toBeUndefined();
    expect(result.state).not.toBeNull();
    return result;
};

describe('DiagFeux — scénarios et plans de fonctionnement', () => {
    const example = (attrs = 'PlanFeuxCourant="Matin"', more = '') => wrap(twoLines +
        plan('Matin', '', phases(15, 15), matrix) + plan('Matin', 'Pointe matin', phases(45, 35)) +
        plan('Soir', '', phases(20, 20), matrix + more, 'Définitif="true"') + plan('Soir', 'Pointe soir', phases(60, 48)), '', attrs);
    it('importe les plans réels, choisit le scénario définitif et aligne l’état actif', () => {
        const { state } = get(example());
        expect(state.pfTabs.map(p => [p.name, p.cycleLength])).toEqual([['Pointe matin', 80], ['Pointe soir', 108]]);
        expect(state.activePFId).toBe(2);
        expect(state.cycleLength).toBe(108);
        expect(state.groups.map(g => g.durations.green)).toEqual([53, 39]);
        expect(state.pfTabs[0].diagram.map(d => d.greenDuration)).toEqual([38, 26]);
        expect(state.conflictMatrix).toEqual([['', 7], [9, '']]);
        expect(state.groups.map(g => [g.offset, g.durations.green])).toEqual(state.pfTabs[1].diagram.map(d => [d.offset, d.greenDuration]));
    });
    it('utilise PlanFeuxCourant si aucun scénario définitif', () => {
        const { state } = get(example().replace('Définitif="true"', 'Définitif="false"'));
        expect(state.activePFId).toBe(1);
        expect(state.cycleLength).toBe(80);
    });
    it('garde la matrice propre à chaque scénario', () => {
        const { state } = get(example('', rd('A', 'B', 8)));
        expect(state.pfTabs[0].conflictMatrix[0][1]).toBe(7);
        expect(state.pfTabs[1].conflictMatrix[0][1]).toBe(11);
    });
    it('reprend un plan de base seul en annonçant ses minima', () => {
        const { state, warnings } = get(wrap(twoLines + plan('Seul', '', phases(), matrix)));
        expect(state.cycleLength).toBe(50);
        expect(state.pfTabs[0].name).toMatch(/minima/);
        expect(warnings.join(' ')).toMatch(/sans plan de fonctionnement/);
    });
    it('conserve le scénario actif si la limite de plans est atteinte', () => {
        const body = twoLines + Array.from({ length: MAX_PF + 2 }, (_, i) =>
            plan(`S${i}`, '', phases(), matrix, i === MAX_PF + 1 ? 'Définitif="1"' : '') +
            plan(`S${i}`, `Programme ${i}`, phases())).join('');
        const { state, warnings } = get(wrap(body));
        expect(state.pfTabs).toHaveLength(MAX_PF);
        expect(state.pfTabs.find(p => p.id === state.activePFId).name).toBe(`Programme ${MAX_PF + 1}`);
        expect(warnings.join(' ')).toMatch(/17 plans/);
    });
    it('conserve les verts mini du plan, et le maximum si les plans divergent', () => {
        const xml = example('', '<VertMiniVéhiculesPlan>9</VertMiniVéhiculesPlan>');
        const { state, warnings } = get(xml);
        expect(state.groups.every(g => g.minGreen === 9)).toBe(true);
        expect(state.pfTabs[1].remarques).toContain('A=9');
        expect(state.pfTabs[0].remarques).toContain('A=6');
        expect(warnings.join(' ')).toMatch(/maximum/);
    });
});

describe('DiagFeux — matrice et horaires cycliques', () => {
    it('ignore zéros compatibles et diagonales, mais respecte une incompatibilité symétrique à rouge nul', () => {
        const body = line('A', 'R11', '<Incompatible IDAdverse="B"/><RougeDégagement IDAdverse="A">0</RougeDégagement><RougeDégagement IDAdverse="B">0</RougeDégagement>') +
            line('B', 'R11', '<RougeDégagement IDAdverse="A">0</RougeDégagement>') + line('C') +
            plan('S', '', phase(30, ref('A') + ref('C')) + phase(30, ref('B')), rd('A', 'C', 0));
        const { state } = get(wrap(body));
        expect(state.conflictMatrix).toEqual([['', 3, ''], [3, '', ''], ['', '', '']]);
    });
    it('utilise la matrice du plan, y compris ses zéros, avant celle de la variante', () => {
        const body = line('A', 'R11', '<RougeDégagement IDAdverse="B">9</RougeDégagement>') + line('B') + plan('S', '', phases(), rd('A', 'B', 0));
        expect(get(wrap(body)).state.conflictMatrix[0][1]).toBe('');
    });
    it('ajoute les incompatibilités propres au plan', () => {
        const xml = wrap(twoLines + plan('S', '', phases(), rd('A', 'B', 0) + rd('B', 'A', 0) + '<Incompatibles IdLfInc1="A" IdLfInc2="B"/>'));
        expect(get(xml).state.conflictMatrix).toEqual([['', 3], [3, '']]);
    });
    it('garde le vert sur deux phases, indépendamment des lignes déjà actives', () => {
        const xml = wrap(twoLines + line('C') + plan('S', '', phase(30, ref('A') + ref('B')) + phase(20, ref('A')) + phase(15, ref('C')), rd('A', 'B', 25) + rd('A', 'C', 3)));
        const { state } = get(xml);
        expect(state.groups[0].durations.green).toBe(44);
    });
    it('retarde l’ouverture et avance la fermeture, sans déplacer les antagonistes', () => {
        const xml = wrap(twoLines + plan('S', '', phase(40, ref('A')) + phase(20, ref('B', 2, 1)), matrix));
        const { state } = get(xml);
        expect(state.groups.map(g => [g.offset, g.durations.green])).toEqual([[0, 33], [42, 8]]);
    });
    it('traite la continuité entre dernière et première phase', () => {
        const xml = wrap(twoLines + line('C') + plan('S', '', phase(20, ref('A', 2, 1)) + phase(30, ref('B')) + phase(10, ref('A', 2, 1) + ref('C')), rd('A', 'B', 4)));
        const { state } = get(xml);
        expect(state.groups[0].offset).toBe(52);
        expect(state.groups[0].durations.green).toBe(20);
    });
    it('signale les groupes sans phase et les matrices absentes', () => {
        const { state, warnings } = get(wrap(twoLines + plan('S', '', phase(30, ref('A')))));
        expect(state.groups[1].durations.green).toBe(0);
        expect(warnings.join(' ')).toMatch(/B.*absente des phases/);
        expect(warnings.join(' ')).toMatch(/matrice.*vide/);
    });
    it.each([
        [phase(20, ref('A')) + phase(20, ref('B')) + phase(20, ref('A')) + phase(20, ref('B')), /non contiguës/],
        [phase(20, ref('A')) + phase(20, ref('A') + ref('B')), /toutes les phases/],
        [phase(-1, ref('A')) + phase(20, ref('B')), /durée de phase/],
        [phase('abc', ref('A')), /durée de phase/],
        [phase(20, ref('Inconnue')), /inconnue/],
        [phase(2, ref('A')) + phase(2, ref('B')), /durées incompatibles/],
        [phase(20, ref('A', -1)) + phase(20, ref('B')), /décalages incohérents/]
    ])('refuse des horaires qu’il ne peut convertir fidèlement (%s)', (p, message) => {
        expect(parseDiagfeux(wrap(twoLines + plan('S', '', p, matrix))).error).toMatch(message);
    });
});

describe('DiagFeux — signaux, propriétés et XML .NET', () => {
    it('déduit le type du signal même après renommage, et importe les jaunes et minima', () => {
        const codes = ['R12', 'R13b', 'R13c', 'R13t', 'R11j', 'R14tg'];
        const ids = ['Traversee', 'PBus', 'Velo', 'Tram', 'Clignotant', 'Tourne'];
        const xml = wrap(codes.map((c, i) => line(ids[i], c)).join('') + plan('S', '', phase(30, ref(ids[0]) + ref(ids[1]) + ref(ids[4]))) + plan('T', '', phase(30, ref(ids[2]) + ref(ids[3]) + ref(ids[5])), '<VertMiniPiétonsPlan>12</VertMiniPiétonsPlan>'));
        const { state } = get(xml);
        expect(state.groups.map(g => g.type)).toEqual(['P', 'B', 'CY', 'B', 'V', 'V']);
        expect(state.groups.map(g => g.durations.orange)).toEqual([0, 3, 3, 3, 5, 3]);
        expect(state.groups[0].minGreen).toBe(12);
        expect(state.groups[3].signal).toBe('R17');
    });
    it('normalise les dates sans les décaler de fuseau et garde les métadonnées sans champ dédié', () => {
        const xml = wrap(twoLines + plan('S', '', phases()), '<DateEtude>2011-04-12T00:00:00+02:00</DateEtude><DateModification>2012-05-01T12:00:00Z</DateModification><ObjectifEtude>Essai</ObjectifEtude><ZoneRégulation>Zone fictive</ZoneRégulation>');
        const { state } = get(xml);
        expect(state.projectProperties.dateCreation).toBe('2011-04-12');
        expect(state.projectProperties.dateModification).toBe('2012-05-01');
        expect(state.projectProperties.commentaires).toContain('Zone fictive');
    });
    it('ignore le schéma embarqué et lit namespaces, BOM, accents décomposés et variante de casse de la racine', () => {
        const xml = wrap(twoLines + plan('S', '', phases()))
            .replace('<Carrefour>', '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="Carrefour"/></xs:schema><Carrefour>')
            .replaceAll('DataSetDiagfeux', 'DataSetDiagFeux').normalize('NFD');
        expect(get('\uFEFF' + xml).state.groups).toHaveLength(2);
    });
    it('refuse les identifiants dupliqués ou absents et les projets trop grands', () => {
        expect(parseDiagfeux(wrap(line('A') + line('A'))).error).toMatch(/dupliqués/);
        expect(parseDiagfeux(wrap(line(''))).error).toMatch(/absents/);
        expect(parseDiagfeux(wrap(Array.from({ length: 33 }, (_, i) => line(`G${i}`)).join(''))).error).toMatch(/32 groupes/);
    });
    it('garde un projet sans plan, mais annonce les horaires manquants', () => {
        const { state, warnings } = get(wrap(twoLines));
        expect(state.pfTabs).toHaveLength(1);
        expect(state.cycleLength).toBe(60);
        expect(warnings.join(' ')).toMatch(/Aucun PlanFeux/);
    });
    it.each([0, 1, 2, 5])('avertit pour la version %i', version => {
        const { warnings } = get(wrap(twoLines + plan('S', '', phases()), '', '', version));
        expect(warnings.join(' ')).toMatch(/format|version/i);
    });
});

describe('DiagFeux — affectation des trafics', () => {
    const branches = '<Branche><NomRue>A</NomRue></Branche><Branche><NomRue>B</NomRue></Branche>';
    const trajectory = (id, from, to) => `<Trajectoire IDLigneDeFeux="${id}"><Véhicules><VoieOrigine>${from}</VoieOrigine><VoieDestination>${to}</VoieDestination></Véhicules></Trajectoire>`;
    const traffic = (name = 'Pointe', uvp = true, q = [0, 100, 200, 0]) => `<Trafic><Nom>${name}</Nom><UVP>${uvp}</UVP>${q.map(n => `<QVéhicule>${n}</QVéhicule>`).join('')}<QPiéton>50</QPiéton><QPiéton>80</QPiéton></Trafic>`;
    const trafficXml = extra => wrap('<ModeGraphique>true</ModeGraphique>' + branches + twoLines + trajectory('A', 0, 8) + trajectory('B', 8, 0) + extra + plan('S', '', phases(), matrix, 'IDTrafic="0"'), '');
    it('agrège chaque couple une seule fois, et lie le jeu au plan', () => {
        const { state } = get(trafficXml(trajectory('A', 1, 9) + traffic()));
        expect(state.trafficDatasets.Pointe).toEqual({ 1: { trafficVol: 100 }, 2: { trafficVol: 200 } });
        expect(state.pfTrafficDatasetMap).toEqual({ 1: 'Pointe' });
        expect(state.activeTrafficDataset).toBe('Pointe');
    });
    it('convertit les triplets VL/PL/2R en uvp/h', () => {
        const { state } = get(trafficXml(traffic('HPS', false, [0, 0, 0, 100, 10, 5, 200, 20, 10, 0, 0, 0])));
        expect(state.trafficDatasets.HPS[1].trafficVol).toBe(121.5);
        expect(state.trafficDatasets.HPS[2].trafficVol).toBe(243);
    });
    it('ne double pas un courant partagé et conserve sa source', () => {
        const { state, warnings } = get(trafficXml(trajectory('B', 0, 8) + traffic()));
        expect(state.trafficDatasets.Pointe).toEqual({});
        expect(warnings.join(' ')).toMatch(/courant partagé/);
        expect(state.projectProperties.commentaires).toContain('0, 100, 200, 0');
    });
    it('laisse vide une donnée incomplète, sans inventer un zéro', () => {
        const { state } = get(trafficXml(traffic('HPM', true, [0, 100])));
        expect(state.trafficDatasets.HPM).toEqual({});
    });
    it('conserve les noms en doublon sans écrasement, même les noms réservés JavaScript', () => {
        const { state } = get(trafficXml(traffic('__proto__') + traffic('__proto__')));
        expect(state.customTrafficDatasetNames).toEqual(['__proto__', '__proto__ (2)']);
        expect(state.trafficDatasets['__proto__'][1].trafficVol).toBe(100);
    });
    it('garde les trafics du mode tableur dans les commentaires', () => {
        const { state, warnings } = get(trafficXml(traffic()).replace('<ModeGraphique>true</ModeGraphique>', '<ModeGraphique>false</ModeGraphique>'));
        expect(state.trafficDatasets.Pointe).toEqual({});
        expect(warnings.join(' ')).toMatch(/mode tableur/);
        expect(state.projectProperties.commentaires).toContain('QVéhicule');
    });
    it('reprend le trafic piéton d’une traversée dont la branche est certaine', () => {
        const xml = wrap('<ModeGraphique>true</ModeGraphique>' + branches + line('Traversee', 'R12') + '<Trajectoire IDLigneDeFeux="Traversee"><Piétons><IDP1>2</IDP1><IDP2>3</IDP2></Piétons></Trajectoire>' + traffic() + plan('S', '', phase(30, ref('Traversee'))), '');
        expect(get(xml).state.trafficDatasets.Pointe[1].trafficVol).toBe(80);
    });
});
