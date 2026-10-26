import type { Groupe, Matrice } from '../types/projet';

const TYPES = new Set(['V', 'VL', 'B', 'TC', 'P', 'Piéton', 'CY', 'Cycliste', 'FL', 'PP']);
const SANS_JAUNE_TRICOLORE = new Set(['P', 'Piéton', 'CY', 'Cycliste', 'FL', 'PP']);

/** Préparation des données, sans prétendre certifier l'exhaustivité de la matrice. */
export function evaluerPrerequisAssistant(groupes: Groupe[], matrice: Matrice) {
    const requis = Math.ceil(groupes.length * 0.8);
    const renseignes = groupes.filter(g => {
        const nom = g.name?.trim();
        const jaune = g.durations?.orange;
        return nom && !/^Groupe\s+\d+$/i.test(nom)
            && TYPES.has(g.type)
            && Number.isFinite(g.minGreen) && g.minGreen > 0
            && Number.isFinite(jaune)
            && (SANS_JAUNE_TRICOLORE.has(g.type) ? jaune >= 0 : jaune > 0);
    }).length;
    // Une case vide indique aussi l'absence de conflit : exiger toutes les
    // cases remplies rendrait impossible un carrefour normalement renseigné.
    const matriceRenseignee = matrice.length === groupes.length
        && matrice.every(ligne => ligne.length === groupes.length)
        && matrice.some((ligne, i) => ligne.some((valeur, j) => i !== j
            && valeur !== '' && String(valeur).trim() !== '' && Number.isFinite(Number(valeur)) && Number(valeur) > 0));
    const raisons: string[] = [];
    if (!matriceRenseignee) raisons.push('Renseignez les temps interverts de la matrice (hors diagonale).');
    if (!groupes.length || renseignes < requis) raisons.push(
        `Complétez au moins 80 % des groupes du formulaire : ${renseignes}/${groupes.length} renseignés, ${requis} requis. `
        + 'Chaque groupe doit avoir un nom personnalisé, un type, un mini positif et un jaune (ou dégagement) renseigné.');
    return { pret: raisons.length === 0, renseignes, requis, matriceRenseignee, message: raisons.join('\n') };
}

export const INFOBULLE_ASSISTANT = 'Assistant de conception pour les carrefours simples : à partir des trafics, du formulaire et de la matrice, '
    + 'aide à choisir les groupes déterminants et le phasage, calcule le cycle de Webster et répartit les verts. '
    + 'Propose le placement des groupes associés, des adaptatifs verticaux, des fermetures anticipées et des points de repos bus.\n\n'
    + 'Limites : les résultats dépendent des données saisies et doivent être vérifiés et adaptés par un concepteur compétent. '
    + 'Les carrefours complexes, les bi-carrefours et les stratégies particulières de priorité ou de coordination demandent une étude spécifique. '
    + 'L’assistant ne remplace ni l’expertise du traficien ni la vérification des contraintes de sécurité et de la réglementation.';
