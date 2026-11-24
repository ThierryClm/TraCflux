/**
 * Seuils de l'analyse du diagramme.
 *
 * Ils sont réglés une fois pour l'application (menu Diagramme ▸ Options ▸
 * Réglage des seuils...) et enregistrés dans le navigateur : ils s'appliquent
 * donc à tous les projets ouverts sur ce poste. Les valeurs par défaut suivent
 * l'ISR (règlement), le guide Certu 2010 (recommandations) et les choix de
 * conception retenus pour TraCflux.
 */

export interface SeuilsAnalyse {
    /** Vert minimum réglementaire d'un groupe de feux (ISR, art. 110 C1). */
    vertMiniReglementaire: number;
    /** Vert apportant plus de confort, au-dessus du minimum réglementaire. */
    vertConfort: number;
    /** Vert plus rationnel en capacité (guide Certu). */
    vertCapacite: number;
    /** Au-delà, un vert n'écoule plus de trafic supplémentaire. */
    vertLong: number;
    /** Attente maximale de tout usager (ISR, art. 110 C3). */
    attenteMaxi: number;
    /** Attente maximale ponctuelle des transports en commun aux feux R17/R18. */
    attenteMaxiTC: number;
    /** Attente maximale tolérée pour un piéton (seuil de tolérance). */
    attentePietonMaxi: number;
    /** Retard moyen des piétons au-delà duquel l'analyse signale le plan. */
    retardPietonMaxi: number;
    /** Durée minimale d'un cycle. */
    cycleMini: number;
    /** Traversée piétonne au-delà de laquelle un refuge est recommandé (m). */
    traverseeSansRefuge: number;
    /** Réserve de capacité faible, en dessous de laquelle on suggère de vérifier. */
    capaciteReserveFaible: number;
    /** Capacité utilisée à partir de laquelle on alerte (point d'attention). */
    capaciteUtiliseeAlerte: number;
    /** Capacité utilisée à partir de laquelle le courant est saturé. */
    capaciteUtiliseeSaturee: number;
}

export const SEUILS_ANALYSE_DEFAUT: SeuilsAnalyse = {
    vertMiniReglementaire: 6,
    vertConfort: 8,
    vertCapacite: 10,
    vertLong: 40,
    attenteMaxi: 120,
    attenteMaxiTC: 240,
    attentePietonMaxi: 50,
    retardPietonMaxi: 20,
    cycleMini: 40,
    traverseeSansRefuge: 12,
    capaciteReserveFaible: 70,
    capaciteUtiliseeAlerte: 90,
    capaciteUtiliseeSaturee: 100
};

/** Clé de stockage locale : préférence d'application, comme les infobulles. */
export const CLE_SEUILS_ANALYSE = 'analyseDiagrammeSeuils';

/** Une valeur utilisable : un nombre fini, positif ou nul. */
const nombreValide = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Complète des seuils partiels avec les valeurs par défaut. */
export const completerSeuils = (partiels?: Partial<SeuilsAnalyse> | null): SeuilsAnalyse => {
    const resultat = { ...SEUILS_ANALYSE_DEFAUT };
    if (partiels) {
        (Object.keys(SEUILS_ANALYSE_DEFAUT) as (keyof SeuilsAnalyse)[]).forEach(cle => {
            const v = partiels[cle];
            if (nombreValide(v)) resultat[cle] = v;
        });
    }
    return resultat;
};

/** Relit les seuils enregistrés sur ce poste ; les valeurs par défaut au besoin. */
export const chargerSeuilsAnalyse = (): SeuilsAnalyse => {
    if (typeof localStorage === 'undefined') return { ...SEUILS_ANALYSE_DEFAUT };
    try {
        const brut = localStorage.getItem(CLE_SEUILS_ANALYSE);
        if (!brut) return { ...SEUILS_ANALYSE_DEFAUT };
        const lu: unknown = JSON.parse(brut);
        return completerSeuils(lu && typeof lu === 'object' ? lu as Partial<SeuilsAnalyse> : null);
    } catch {
        return { ...SEUILS_ANALYSE_DEFAUT };
    }
};

/** Enregistre les seuils pour l'application entière. */
export const enregistrerSeuilsAnalyse = (seuils: SeuilsAnalyse): void => {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(CLE_SEUILS_ANALYSE, JSON.stringify(completerSeuils(seuils)));
    } catch {
        // Stockage plein ou bloqué : l'application garde les seuils en mémoire.
    }
};

/** Revient aux valeurs par défaut et les enregistre. */
export const reinitialiserSeuilsAnalyse = (): SeuilsAnalyse => {
    const defauts = { ...SEUILS_ANALYSE_DEFAUT };
    enregistrerSeuilsAnalyse(defauts);
    return defauts;
};
