import type { Groupe, JeuTrafic } from '../types/projet';
import { attr, boolOf, kid, kids, numOf, txt, value } from './diagfeuxXml';

/**
 * Agrège uniquement les couples O-D dont le groupe est déterminable. Les voies
 * DiagFeux sont codées branche * 8 + voie ; les passages, branche * 2 + passage.
 * Un courant partagé entre plusieurs groupes n'est jamais compté deux fois.
 */
export const readDiagfeuxTraffic = (variante: Element, groups: Groupe[], warnings: string[]) => {
    const trafics = kids(variante, 'Trafic');
    const branches = kids(variante, 'Branche');
    const trajectories = kids(variante, 'Trajectoire');
    const datasets: Record<string, JeuTrafic> = Object.create(null);
    const names: string[] = [];
    const comments: string[] = [];
    const couples = groups.map(() => new Set<number>());
    const pedestrianBranches = groups.map(() => new Set<number>());
    const invalid = new Set<number>();
    const index = new Map(groups.map((g, i) => [g.name, i]));
    const count = branches.length;
    const graphical = boolOf(variante, 'ModeGraphique');
    const validCode = (n: number, size: number): boolean => Number.isInteger(n) && n >= 0 && n < count * size;

    for (const t of trajectories) {
        const i = index.get(attr(t, 'IDLigneDeFeux'));
        if (i === undefined) continue;
        const v = kid(t, 'Véhicules');
        const p = kid(t, 'Piétons');
        if (v && groups[i].type !== 'P') {
            const from = numOf(v, 'VoieOrigine', NaN), to = numOf(v, 'VoieDestination', NaN);
            if (validCode(from, 8) && validCode(to, 8)) {
                couples[i].add(Math.floor(from / 8) * count + Math.floor(to / 8));
            } else invalid.add(i);
        } else if (p && groups[i].type === 'P') {
            for (const name of ['IDP1', 'IDP2']) {
                if (!kid(p, name) && name === 'IDP2') continue;
                const code = numOf(p, name, NaN);
                if (validCode(code, 2)) pedestrianBranches[i].add(Math.floor(code / 2));
                else invalid.add(i);
            }
        }
    }
    const owners = new Map<number, number[]>();
    couples.forEach((keys, i) => keys.forEach(key => owners.set(key, [...(owners.get(key) ?? []), i])));

    trafics.forEach((t, ti) => {
        const original = txt(t, 'Nom') || `Trafic ${ti + 1}`;
        let name = original;
        for (let suffix = 2; Object.hasOwn(datasets, name); suffix++) name = `${original} (${suffix})`;
        names.push(name);
        const dataset: JeuTrafic = Object.create(null);
        datasets[name] = dataset;
        const q = kids(t, 'QVéhicule').map(value);
        const qp = kids(t, 'QPiéton').map(value);
        const uvp = boolOf(t, 'UVP');
        const stride = uvp ? 1 : 3;
        const validQ = count > 0 && q.length === count * count * stride && q.every(v => Number.isFinite(v) && v >= 0);
        const validQP = count > 0 && qp.length === count && qp.every(v => Number.isFinite(v) && v >= 0);
        let missing = 0;
        groups.forEach((g, i) => {
            let volume: number | undefined;
            if (graphical && !invalid.has(i)) {
                if (g.type === 'P' && validQP && pedestrianBranches[i].size === 1) {
                    volume = qp[[...pedestrianBranches[i]][0]];
                } else if (g.type !== 'P' && validQ && couples[i].size > 0 &&
                    [...couples[i]].every(key => owners.get(key)?.length === 1)) {
                    volume = [...couples[i]].reduce((sum, key) => {
                        const k = key * stride;
                        return sum + (uvp ? q[k] : q[k] + 2 * q[k + 1] + 0.3 * q[k + 2]);
                    }, 0);
                }
            }
            if (volume !== undefined) dataset[g.id] = { trafficVol: Math.round(volume * 10) / 10 };
            else missing++;
        });
        if (missing) warnings.push(`Trafic « ${name} » : ${missing} groupe(s) sans affectation certaine (mode tableur, trajectoires absentes, courant partagé ou données incomplètes). Matrices O-D conservées dans les commentaires du projet.`);
        if (!uvp && Object.keys(dataset).length) warnings.push(`Trafic « ${name} » : conversion en uvp/h avec PL × 2 et deux-roues × 0,3.`);
        // Conserver aussi les données sources non affectables, sans transformer
        // une absence d'information en débit nul.
        comments.push([
            `Trafic DiagFeux « ${name} » — ${uvp ? 'uvp/h' : 'véhicules/h, triplets VL/PL/2R'}.`,
            `Branches dans l'ordre : ${branches.map((b, i) => `${i}: ${txt(b, 'NomRue') || i}`).join(', ')}.`,
            `QVéhicule (origine puis destination, diagonale comprise) : ${kids(t, 'QVéhicule').map(e => e.textContent?.trim()).join(', ')}.`,
            `QPiéton (piétons/h, par branche) : ${kids(t, 'QPiéton').map(e => e.textContent?.trim()).join(', ')}.`,
            txt(t, 'TraficComment')
        ].filter(Boolean).join('\n'));
    });
    return { datasets, names, comments };
};
