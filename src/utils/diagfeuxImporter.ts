/**
 * Import DiagFeux (.dfe) → TraCflux, écrit de zéro d'après le format public du
 * CEREMA (schéma, guide et lecture du code ; aucun code VB repris).
 *
 * Un scénario a un plan de base (minima, matrice), puis des plans de
 * fonctionnement (durées réelles). Le rouge incompressible se calcule vers
 * les lignes nouvelles de la phase suivante, avant leurs décalages.
 * Aucun fichier .dfe réel n'a encore servi à valider cet importateur.
 */
import type { Groupe, Matrice, PlanDeFeu, Projet } from '../types/projet';
import { createEmptyPF, MAX_GROUPS, MAX_PF } from './pfHelpers';
import { attr, boolOf, kid, kids, numOf, txt, value } from './diagfeuxXml';
import { readDiagfeuxTraffic } from './diagfeuxTraffic';

export type DiagfeuxState = Projet & { projectName: string; projectProperties: NonNullable<Projet['projectProperties']> };
export interface DiagfeuxResult {
    state: DiagfeuxState | null;
    warnings: string[];
    error?: string;
}
interface SourcePlan { plan: Element | null; base: Element | null; name: string }
const boolAttr = (e: Element | null, name: string): boolean => /^(true|1)$/i.test(attr(e, name));
const positive = (e: Element | null, name: string, fallback: number): number => {
    const n = numOf(e, name, fallback);
    return n > 0 ? n : fallback;
};
const dateOnly = (s: string): string => /^\d{4}-\d{2}-\d{2}/.exec(s)?.[0] ?? '';

/** Matrices orientées ; les incompatibilités, écrites une fois, sont symétriques. */
const readMatrix = (lignes: Element[], ids: string[], base: Element | null, jaunes: number[], warnings: string[]) => {
    const index = new Map(ids.map((id, i) => [id, i]));
    const rouges: (number | undefined)[][] = ids.map(() => ids.map(() => undefined));
    const incompatible = ids.map(() => ids.map(() => false));
    const put = (from: string, to: string, v: number) => {
        const i = index.get(from), j = index.get(to);
        if (i !== undefined && j !== undefined && Number.isFinite(v) && v >= 0) rouges[i][j] = v;
    };
    const inc = (from: string, to: string) => {
        const i = index.get(from), j = index.get(to);
        if (i !== undefined && j !== undefined) incompatible[i][j] = incompatible[j][i] = true;
    };
    lignes.forEach((lf, i) => {
        kids(lf, 'RougeDégagement').forEach(rd => put(ids[i], attr(rd, 'IDAdverse'), value(rd)));
        kids(lf, 'Incompatible').forEach(c => inc(ids[i], attr(c, 'IDAdverse')));
    });
    kids(base, 'RougesDégagement').forEach(rd => put(attr(rd, 'IdLfRouge1'), attr(rd, 'IdLfRouge2'), value(rd)));
    kids(base, 'Incompatibles').forEach(c => inc(attr(c, 'IdLfInc1'), attr(c, 'IdLfInc2')));
    const matrix: Matrice = ids.map((_, i) => ids.map((_, j) => {
        if (i === j) return '';
        const rouge = rouges[i][j];
        // Un 0 écrit pour toutes les paires n'est pas une contrainte. En
        // revanche, une paire explicitement incompatible avec rouge 0 en est une.
        if (rouge === undefined || (!incompatible[i][j] && rouge === 0)) return '';
        return Math.round(rouge + jaunes[i]);
    }));
    if (rouges.every(row => row.every(v => v === undefined))) warnings.push('Aucun rouge de dégagement lisible : matrice d’interverts vide, horaires à vérifier.');
    if (incompatible.some((row, i) => row.some((v, j) => i !== j && v && rouges[i][j] === undefined))) warnings.push('Rouges de dégagement manquants pour des lignes incompatibles : contraintes incomplètes, à compléter.');
    if (matrix.some(row => row.some(v => typeof v === 'number' && v > 20))) warnings.push('Des interverts dépassent 20 s : ils excèdent la plage de saisie actuelle de TraCflux et doivent être vérifiés.');
    return { matrix, rouges };
};

const readTimings = (source: SourcePlan, ids: string[], jaunes: number[], rouges: (number | undefined)[][], warnings: string[]) => {
    const phases = kids(source.plan, 'Phase');
    const zero = ids.map(() => ({ offset: 0, green: 0 }));
    if (!phases.length) {
        warnings.push(`Plan « ${source.name} » sans phases : groupes sans vert, à saisir.`);
        return { cycle: 60, timings: zero };
    }
    const durations = phases.map(p => numOf(p, 'Durée', NaN));
    if (durations.some(d => !Number.isInteger(d) || d < 0) || durations.every(d => d === 0)) {
        throw new Error(`Plan « ${source.name} » : durée de phase absente ou invalide.`);
    }
    let cycle = 0;
    const starts = durations.map(d => { const s = cycle; cycle += d; return s; });
    const refs = phases.map(p => new Map(kids(p, 'IDLigneFeux').map(r => [(r.textContent ?? '').trim().normalize('NFC'), r])));
    const unknown = [...new Set(refs.flatMap(m => [...m.keys()].filter(id => !ids.includes(id))))];
    if (unknown.length) throw new Error(`Plan « ${source.name} » : ligne(s) inconnue(s) ${unknown.join(', ')}.`);
    const timings = ids.map((id, i) => {
        const present = refs.map(m => m.has(id));
        const n = phases.length;
        if (!present.some(Boolean)) {
            warnings.push(`Plan « ${source.name} », ligne « ${id} » absente des phases : vert nul, à vérifier.`);
            return zero[i];
        }
        // Une seule fenêtre continue, éventuellement à cheval sur le cycle.
        // Refuser une géométrie ambiguë plutôt qu'inventer un vert englobant.
        const firsts = present.flatMap((v, k) => v && !present[(k + n - 1) % n] ? [k] : []);
        if (firsts.length !== 1 && n > 1) throw new Error(`Plan « ${source.name} », ligne « ${id} » : phases non contiguës ou présence sur toutes les phases, conversion à vérifier manuellement.`);
        const first = firsts[0] ?? 0;
        let last = first, span = durations[first];
        while (n > 1 && present[(last + 1) % n] && (last + 1) % n !== first) {
            last = (last + 1) % n;
            span += durations[last];
        }
        // Les décalages sont des propriétés de la ligne, répétées sur chaque
        // phase dans le fichier .NET. Lire aussi les répétitions partielles.
        const shift = (name: string) => {
            const vals = [...new Set(refs.filter(m => m.has(id)).map(m => attr(m.get(id), name)).filter(Boolean).map(Number).filter(v => v !== 0))];
            if (vals.some(v => !Number.isInteger(v) || v < 0) || vals.length > 1) throw new Error(`Plan « ${source.name} », ligne « ${id} » : décalages incohérents.`);
            return vals[0] ?? 0;
        };
        const opening = shift('DécalageOuvre'), closing = shift('DécalageFerme');
        const next = (last + 1) % n;
        const clearance = Math.max(0, ...ids.map((adverse, j) => refs[next].has(adverse) && !refs[last].has(adverse) ? (rouges[i][j] ?? 0) : 0));
        const green = span - opening - closing - clearance - jaunes[i];
        if (green < 0 || green + jaunes[i] > cycle) throw new Error(`Plan « ${source.name} », ligne « ${id} » : durées incompatibles avec les dégagements et les décalages.`);
        return { offset: (starts[first] + opening) % cycle, green };
    });
    return { cycle, timings };
};

/** Parse les données utiles du fichier, en ignorant son schéma embarqué. */
export const parseDiagfeux = (xmlText: unknown): DiagfeuxResult => {
    const warnings: string[] = [];
    const fail = (error: string): DiagfeuxResult => ({ state: null, warnings, error });
    if (!xmlText || typeof xmlText !== 'string') return fail('Fichier vide ou illisible.');
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagNameNS('*', 'parsererror').length) return fail('XML invalide (erreur de parsing).');
    const root = doc.documentElement;
    const carrefour = kid(root, 'Carrefour') || kid(kid(root, 'SchémaACONDIA'), 'Carrefour');
    if (!carrefour) return fail('Aucun carrefour trouvé : fichier de paramètres seul (Diagfeux.par) ou format non reconnu.');
    const variantes = kids(carrefour, 'Variante');
    if (!variantes.length) return fail('Le carrefour ne contient aucune Variante.');
    if (variantes.length > 1) warnings.push(`${variantes.length} variantes présentes : seule la première est importée.`);
    const variante = variantes[0], props = kid(carrefour, 'Propriétés');
    const lignes = kids(variante, 'LigneDeFeux');
    if (!lignes.length) return fail('La variante ne contient aucune LigneDeFeux.');
    if (lignes.length > MAX_GROUPS) return fail(`Le fichier dépasse la limite de ${MAX_GROUPS} groupes de TraCflux.`);
    const ids = lignes.map(lf => txt(lf, 'ID'));
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) return fail('Identifiants de lignes absents ou dupliqués.');
    const enAgglo = !kid(props, 'EnAgglo') || boolOf(props, 'EnAgglo');
    const version = Number(attr(kid(root, 'Paramétrage'), 'Version') || 0);
    if (version <= 1) warnings.push('Ancien format ACONDIA : association des scénarios à vérifier sur le fichier source.');
    else if (version === 2) warnings.push('Format DiagFeux version 2 : compatibilité à vérifier.');
    else if (version !== 3) warnings.push(`Version DiagFeux « ${version} » non documentée : résultat à vérifier.`);

    const groups: Groupe[] = lignes.map((lf, i) => {
        let signal = attr(kid(lf, 'Signal'), 'strCode');
        if (!signal) {
            signal = /^p/i.test(ids[i]) ? 'R12' : 'R11';
            warnings.push(`Ligne « ${ids[i]} » sans signal : ${signal === 'R12' ? 'type piéton' : 'type véhicule'} supposé d’après son identifiant, à vérifier.`);
        }
        const pieton = signal === 'R12';
        const type = pieton ? 'P' : signal === 'R13c' ? 'CY' : ['R13b', 'R13t'].includes(signal) ? 'B' : 'V';
        if (!/^(R11j?|R12|R13[bct]|R14(d|dtd|dtg|td|tg)|R24)$/.test(signal)) warnings.push(`Signal « ${signal} » de « ${ids[i]} » non reconnu : type VL à vérifier.`);
        const directions = ['TAD', 'TD', 'TAG'].filter(k => boolOf(lf, k));
        const courant = directions.includes('TD')
            ? directions.length === 3 ? 'TD_G_D' : directions.includes('TAD') ? 'TD_TàD' : directions.includes('TAG') ? 'TD_TàG' : 'TD'
            : directions.length === 1 ? directions[0] === 'TAD' ? 'TàD' : 'TàG' : '';
        const anticipation = txt(lf, 'SignalAnticipation');
        return {
            id: i + 1, name: ids[i], type,
            signal: signal === 'R11' ? 'R11v' : signal === 'R13t' ? 'R17' : signal,
            courant: pieton ? 'Piéton' : type === 'CY' ? 'Cycle' : courant,
            minGreen: positive(variante, pieton ? 'VertMiniPiétons' : 'VertMiniVéhicules', 6),
            offset: 0,
            durations: { green: 0, orange: pieton ? 0 : (!enAgglo || signal === 'R11j' ? 5 : 3), red: 0 },
            laneCoef: positive(lf, 'NbVoies', 1),
            comment: [txt(kids(variante, 'Branche')[numOf(lf, 'NumBranche', -1)], 'NomRue'), signal === 'R13t' && 'Signal DiagFeux : R13t', anticipation && `Anticipation : ${anticipation}`, directions.length && `Mouvements : ${directions.join(', ')}`].filter(Boolean).join(' — ')
        };
    });
    const jaunes = groups.map(g => g.durations.orange);
    const plans = kids(variante, 'PlanFeux');
    const bases = plans.filter(p => !txt(p, 'NomFonctionnement'));
    const sources: SourcePlan[] = [];
    for (const plan of plans) {
        const name = txt(plan, 'NomFonctionnement');
        if (name) {
            const base = bases.find(b => attr(b, 'ID') === attr(plan, 'ID')) ?? (version <= 1 && bases.length === 1 ? bases[0] : null);
            if (!base) warnings.push(`Plan « ${name} » sans plan de base associé : matrice et minima de la variante utilisés.`);
            sources.push({ plan, base, name });
        } else if (!plans.some(p => txt(p, 'NomFonctionnement') && attr(p, 'ID') === attr(plan, 'ID'))) {
            sources.push({ plan, base: plan, name: `${attr(plan, 'ID') || 'Scénario'} — base (minima)` });
            warnings.push(`Scénario « ${attr(plan, 'ID') || 'sans nom'} » sans plan de fonctionnement : seul le plan de base (minima) est repris.`);
        }
    }
    if (!sources.length) {
        sources.push({ plan: null, base: null, name: 'PF1' });
        warnings.push('Aucun PlanFeux : groupes sans horaires, à saisir.');
    }
    const final = sources.find(s => boolAttr(s.base, 'Définitif') || boolAttr(s.plan, 'Définitif'));
    const preferred = final ?? sources.find(s => attr(s.base ?? s.plan, 'ID') === attr(variante, 'PlanFeuxCourant')) ?? sources[0];
    // Conserver le plan actif même si la limite impose une sélection.
    const retained = sources.slice(0, MAX_PF);
    if (!retained.includes(preferred)) retained[MAX_PF - 1] = preferred;
    if (sources.length > MAX_PF) warnings.push(`${sources.length} plans : ${MAX_PF} repris, dont le plan actif du scénario retenu. Les autres ne sont pas importés.`);
    const minima = groups.map(g => retained.map(s => positive(s.base, g.type === 'P' ? 'VertMiniPiétonsPlan' : 'VertMiniVéhiculesPlan', g.minGreen)));
    groups.forEach((g, i) => { g.minGreen = Math.max(...minima[i]); });
    if (minima.some(values => new Set(values).size > 1)) warnings.push('Verts minimaux différents selon les scénarios : TraCflux les partage entre les plans. Le maximum est conservé ; les valeurs sources figurent dans les remarques de chaque plan.');
    let pfTabs: PlanDeFeu[];
    try {
        pfTabs = retained.map((s, i) => {
            const { matrix, rouges } = readMatrix(lignes, ids, s.base, jaunes, warnings);
            const { cycle, timings } = readTimings(s, ids, jaunes, rouges, warnings);
            return createEmptyPF({
                id: i + 1, name: s.name, cycleLength: cycle, conflictMatrix: matrix,
                diagram: groups.map((g, j) => ({ groupId: g.id, offset: timings[j].offset, greenDuration: timings[j].green, comment: g.comment })),
                remarques: `Import DiagFeux — scénario : ${attr(s.base ?? s.plan, 'ID') || 'sans nom'}.\nVerts minimaux sources (s) : ${groups.map((g, j) => `${g.name}=${minima[j][i]}`).join(', ')}.`
            });
        });
    } catch (e) {
        return fail(e instanceof Error ? e.message : 'Horaires DiagFeux illisibles.');
    }
    const activeIndex = retained.indexOf(preferred), active = pfTabs[activeIndex];
    groups.forEach((g, i) => {
        const d = active.diagram[i];
        g.offset = d.offset;
        g.durations.green = d.greenDuration;
        g.durations.red = active.cycleLength! - d.greenDuration - g.durations.orange;
    });
    const traffic = readDiagfeuxTraffic(variante, groups, warnings);
    const pfTrafficDatasetMap: Record<string, string> = {};
    retained.forEach((s, i) => {
        const id = attr(s.plan, 'IDTrafic') || attr(s.base, 'IDTrafic');
        if (id !== '' && Number.isInteger(Number(id)) && traffic.names[Number(id)]) pfTrafficDatasetMap[pfTabs[i].id] = traffic.names[Number(id)];
        else if (id !== '') warnings.push(`Plan « ${s.name} » : référence de trafic « ${id} » introuvable.`);
    });
    const activeTrafficDataset = pfTrafficDatasetMap[active.id] || traffic.names[0] || 'HPM';
    const additional = ['ObjectifEtude', 'ZoneRégulation', 'SystèmeRégulation'].map(k => txt(props, k) && `${k} : ${txt(props, k)}`).filter(Boolean);
    const nom = txt(props, 'Nom') || 'Carrefour importé';
    warnings.push('Géométrie (branches, voies, passages, fond de plan), antagonismes et paramètres de calcul de capacité non repris.');
    return {
        state: {
            projectName: nom, intersectionName: nom, groups,
            cycleLength: active.cycleLength!, conflictMatrix: active.conflictMatrix!, pfTabs, activePFId: active.id,
            trafficDatasets: traffic.datasets, customTrafficDatasetNames: traffic.names, activeTrafficDataset, pfTrafficDatasetMap,
            projectProperties: {
                commune: txt(props, 'Commune'), idCarrefour: txt(props, 'Numéro'),
                controleur: [txt(props, 'Fabricant'), txt(props, 'TypeControleur')].filter(Boolean).join(' '),
                horsAgglomeration: !enAgglo, auteur: txt(props, 'RéalisateurEtude'),
                dateCreation: dateOnly(txt(props, 'DateEtude')), dateModification: dateOnly(txt(props, 'DateModification')),
                commentaires: [txt(props, 'Commentaires'), ...additional, ...traffic.comments].filter(Boolean).join('\n\n')
            }
        }, warnings: [...new Set(warnings)]
    };
};
export default parseDiagfeux;
