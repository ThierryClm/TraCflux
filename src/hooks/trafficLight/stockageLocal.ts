/**
 * Accès au stockage local du navigateur pour useTrafficLight : écriture qui
 * absorbe le dépassement de quota, et libération d'espace avant l'autosave.
 */

// Safe localStorage helper to prevent QuotaExceededError crashes
export const safeLocalStorage = {
    setItem: (key: string, value: string) => {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn(`localStorage quota exceeded for key: ${key}`);
                // Don't crash the app, just skip the save
                return false;
            }
            throw e;
        }
    },
    getItem: (key: string) => localStorage.getItem(key),
    removeItem: (key: string) => localStorage.removeItem(key)
};

// Clés d'une ancienne mécanique de cache, remplacée par la sérialisation
// unifiée dans traffic_project_<nom> : elles étaient encore ÉCRITES mais plus
// jamais relues. Coût réel, bénéfice nul — et 'trafficIntersectionImage'
// stockait une seconde copie de l'image du carrefour en data URL, souvent le
// plus gros objet du cache. Cette occupation morte poussait le quota à
// saturation : l'autosave échouait alors en silence, ou le garde-fou évinçait
// des projets pour faire de la place. D'où des pertes de travail — les flèches
// du carrefour en particulier, posées après le chargement de l'image, donc au
// moment où le cache est déjà plein.
const CLES_CACHE_MORTES = [
    'trafficGroups', 'trafficMatrix', 'trafficName', 'trafficCycle',
    'trafficDependencyGap', 'trafficPfTabs', 'trafficActivePF',
    'trafficIntersectionImage', 'trafficIntersectionArrows', 'trafficDatasets'
];

// Supprime ces clés du navigateur. Renvoie l'espace libéré en octets UTF-16.
const purgerClesMortes = () => {
    let libere = 0;
    for (const cle of CLES_CACHE_MORTES) {
        const valeur = localStorage.getItem(cle);
        if (valeur === null) continue;
        libere += (cle.length + valeur.length) * 2;
        localStorage.removeItem(cle);
    }
    if (libere > 0) {
        console.log(`Nettoyage : ${CLES_CACHE_MORTES.length} clés de cache obsolètes purgées (${(libere / 1024).toFixed(0)} KB)`);
    }
    return libere;
};

// Calculate total localStorage usage in bytes
const getLocalStorageUsage = () => {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key === null) continue;
        const value = localStorage.getItem(key) ?? '';
        // Each character is 2 bytes in JavaScript (UTF-16)
        total += (key.length + value.length) * 2;
    }
    return total;
};

// Free up approximately 1MB of space by removing oldest projects
const freeUpLocalStorage = (targetBytes = 1000000) => {
    let freedBytes = 0;
    const orderRaw = localStorage.getItem('traffic_project_order');
    if (!orderRaw) return freedBytes;

    try {
        const order: string[] = JSON.parse(orderRaw);
        const projectsToRemove: string[] = [];

        // Start from the end (oldest projects)
        for (let i = order.length - 1; i >= 0 && freedBytes < targetBytes; i--) {
            const projectName = order[i];
            const projectKey = `traffic_project_${projectName}`;
            const backupKey = `traffic_project_${projectName}_backup`;

            const projectData = localStorage.getItem(projectKey);
            const backupData = localStorage.getItem(backupKey);

            if (projectData) {
                freedBytes += (projectKey.length + projectData.length) * 2;
                projectsToRemove.push(projectName);
            }
            if (backupData) {
                freedBytes += (backupKey.length + backupData.length) * 2;
            }
        }

        // Remove the projects
        for (const projectName of projectsToRemove) {
            localStorage.removeItem(`traffic_project_${projectName}`);
            localStorage.removeItem(`traffic_project_${projectName}_backup`);
            console.log(`Espace libéré: projet "${projectName}" supprimé`);
        }

        // Update the order
        if (projectsToRemove.length > 0) {
            const newOrder = order.filter(n => !projectsToRemove.includes(n));
            localStorage.setItem('traffic_project_order', JSON.stringify(newOrder));
        }

        return freedBytes;
    } catch (e) {
        console.error('Error freeing localStorage:', e);
        return 0;
    }
};

// Supprime les clés `_backup` orphelines (dont le projet principal n'existe
// plus). Historiquement, l'éviction par plafond comptable retirait le projet
// principal sans toucher au backup, qui s'accumulait silencieusement dans le
// quota. Comme aucun chemin de code ne LIT ces backups (jamais restaurés),
// on peut les supprimer sans risque. Renvoie l'espace libéré en octets UTF-16.
const removeOrphanBackups = () => {
    let freed = 0;
    const orphanKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('traffic_project_') || !key.endsWith('_backup')) continue;
        const mainKey = key.slice(0, -'_backup'.length);
        if (localStorage.getItem(mainKey) === null) {
            const value = localStorage.getItem(key) || '';
            freed += (key.length + value.length) * 2;
            orphanKeys.push(key);
        }
    }
    orphanKeys.forEach(k => localStorage.removeItem(k));
    if (orphanKeys.length > 0) {
        console.log(`Nettoyage : ${orphanKeys.length} _backup orphelin(s) supprimé(s) (${(freed / 1024).toFixed(0)} KB)`);
    }
    return freed;
};

// Vérifie et libère de l'espace si localStorage approche du quota.
// Stratégie en 2 temps : (1) supprimer les _backup orphelins (gratuit, sans
// toucher aux projets actifs) ; (2) si encore au-dessus du seuil, évincer les
// projets les plus anciens. Le seuil est aligné sur ~80 % du quota navigateur
// typique en UTF-16 (~10 Mo), au lieu des 4,5 Mo historiques qui étaient
// déclenchés bien trop tôt par l'accumulation de backups.
export const ensureLocalStorageSpace = () => {
    // (0) Gratuit et sans perte : les clés d'une mécanique abandonnée.
    purgerClesMortes();

    let usage = getLocalStorageUsage();
    const threshold = 8 * 1024 * 1024; // 8 MB UTF-16

    if (usage <= threshold) return true;

    // (1) Récupération gratuite : backups orphelins
    const orphanFreed = removeOrphanBackups();
    usage -= orphanFreed;
    if (usage <= threshold) return true;

    // (2) Encore au-dessus : on évince les projets les plus anciens
    console.log(`localStorage encore au-dessus du seuil (${(usage / 1024 / 1024).toFixed(2)} MB), libération de 1 MB par éviction...`);
    const freed = freeUpLocalStorage(1000000);
    console.log(`Éviction : ${(freed / 1024).toFixed(0)} KB libérés`);
    return freed > 0;
};
