/**
 * Cache des projets dans le navigateur (clés traffic_project_<nom>) : ordre
 * des projets récents, liste, lecture et suppression. Appelé par
 * useTrafficLight.
 */
import type { AlertFunction, ConfirmFunction } from '../../components/ConfirmProvider';
import { safeLocalStorage, ensureLocalStorageSpace } from './stockageLocal';
import type { ProjetEnregistre, SauvegardeCache } from './types';

// Nombre max de projets conservés dans le cache localStorage.
// C'est un plafond de COMPTAGE, pas la vraie limite : le quota réel est en
// octets (~5 Mo navigateur), géré par safeLocalStorage qui absorbe un
// éventuel QuotaExceededError. Monté à 15 : depuis l'optimisation auto des
// images de fond (~250 Ko/projet au lieu de ~800 Ko), bien plus de projets
// tiennent dans le quota (15 × 250 Ko ≈ 3,75 Mo, avec marge).
// Solution de fond pour lever la contrainte de capacité : migration du
// stockage des projets vers IndexedDB (gros chantier — cf. mémoire projet).
export const MAX_CACHED_PROJECTS = 15;

// Update project order - move project to top and limit to MAX_CACHED_PROJECTS
export const mettreProjetEnTete = (name: string) => {
    try {
        const orderRaw = localStorage.getItem('traffic_project_order');
        let order: string[] = orderRaw ? JSON.parse(orderRaw) : [];
        // Remove if already exists
        order = order.filter(n => n !== name);
        // Add to top
        order.unshift(name);

        // Remove old projects beyond the limit (keep last backup)
        while (order.length > MAX_CACHED_PROJECTS) {
            const oldProjectName = order.pop();
            // Delete the old project from localStorage (but keep its backup if exists)
            localStorage.removeItem(`traffic_project_${oldProjectName}`);
            console.log(`Cache nettoyé: projet "${oldProjectName}" supprimé`);
        }

        safeLocalStorage.setItem('traffic_project_order', JSON.stringify(order));
    } catch (e) {
        console.error("Update order failed", e);
    }
};

export const listerProjetsCache = () => {
    const saves: SauvegardeCache[] = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Skip null/undefined keys
            if (!key) continue;
            // Only include main project files (exclude backups and order file)
            if (key.startsWith('traffic_project_') && !key.endsWith('_backup') && key !== 'traffic_project_order') {
                const name = key.replace('traffic_project_', '');
                // Skip empty names
                if (!name) continue;

                const raw = localStorage.getItem(key);
                let savedAt = null;
                let size = 0;

                if (raw) {
                    size = raw.length;
                    try {
                        const data = JSON.parse(raw);
                        savedAt = data.savedAt || null;
                    } catch {
                        // Ignore parse errors
                    }
                }

                saves.push({ name, savedAt, size });
            }
        }

        // Sort by order (most recently loaded first) and limit to MAX_CACHED_PROJECTS
        const orderRaw = localStorage.getItem('traffic_project_order');
        if (orderRaw) {
            const order: string[] = JSON.parse(orderRaw);
            saves.sort((a, b) => {
                const indexA = order.indexOf(a.name);
                const indexB = order.indexOf(b.name);
                // Projects not in order list go to the end
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
        }
    } catch (e) {
        console.error("getAllSaves failed", e);
    }

    // Return all available projects (no limit for display)
    return saves;
};

// Get project data without applying to state (for green wave)
export const lireProjetCache = (name: string): ProjetEnregistre | null => {
    try {
        const raw = localStorage.getItem(`traffic_project_${name}`);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.error("Get project data failed", e);
        return null;
    }
};

export const supprimerProjetCache = (name: string) => {
    localStorage.removeItem(`traffic_project_${name}`);
};

/**
 * Écrit un projet sérialisé dans le cache : place libérée au besoin, copie
 * de secours de l'ancienne version, confirmation si la nouvelle est beaucoup
 * plus petite (perte de données probable), éviction du plus ancien projet si
 * le stockage est plein. Renvoie true si le projet est écrit.
 */
export const ecrireProjetCache = async (
    name: string,
    jsonData: string,
    { askConfirm, alertFn }: { askConfirm?: ConfirmFunction; alertFn: AlertFunction }
): Promise<boolean> => {
    // Vérifier et libérer de l'espace si localStorage est presque plein
    ensureLocalStorageSpace();

    try {
        // Create backup of existing save before overwriting
        const existingSave = localStorage.getItem(`traffic_project_${name}`);
        if (existingSave && existingSave.length > jsonData.length * 0.5) {
            // Existing save is significantly larger - warn user
            const existingSize = existingSave.length;
            const newSize = jsonData.length;
            if (newSize < existingSize * 0.3) {
                // New save is less than 30% of old save - likely data loss
                const ok = askConfirm
                    ? await askConfirm({
                        title: 'Perte de données possible',
                        message: `Attention : la nouvelle sauvegarde (${newSize} car.) est beaucoup plus petite que l'ancienne (${existingSize} car.).\n\nCela pourrait indiquer une perte de données.\n\nVoulez-vous quand même sauvegarder ?`,
                        confirmLabel: 'Sauvegarder',
                        danger: true,
                    })
                    : window.confirm(`Attention: La nouvelle sauvegarde (${newSize} car.) est beaucoup plus petite que l'ancienne (${existingSize} car.).\n\nCela pourrait indiquer une perte de données.\n\nVoulez-vous quand même sauvegarder?`);
                if (!ok) {
                    return false;
                }
            }
            // Keep a backup
            localStorage.setItem(`traffic_project_${name}_backup`, existingSave);
        }

        localStorage.setItem(`traffic_project_${name}`, jsonData);
        return true;
    } catch (e) {
        console.error("Save failed", e);
        if (e.name === 'QuotaExceededError') {
            // Automatically delete the oldest project and retry
            try {
                const orderRaw = localStorage.getItem('traffic_project_order');
                if (orderRaw) {
                    const order: string[] = JSON.parse(orderRaw);
                    // Find the oldest project (last in the list) that is not the current one
                    const oldestProject = order.filter(n => n !== name).pop();
                    if (oldestProject) {
                        localStorage.removeItem(`traffic_project_${oldestProject}`);
                        localStorage.removeItem(`traffic_project_${oldestProject}_backup`);
                        // Update order
                        const newOrder = order.filter(n => n !== oldestProject);
                        localStorage.setItem('traffic_project_order', JSON.stringify(newOrder));
                        console.log(`Espace insuffisant: projet "${oldestProject}" supprimé automatiquement`);
                        // Retry save
                        localStorage.setItem(`traffic_project_${name}`, jsonData);
                        return true;
                    }
                }
            } catch (retryError) {
                console.error("Retry save failed", retryError);
            }
            alertFn({ title: 'Stockage insuffisant', message: 'Espace de stockage insuffisant même après nettoyage.' });
        } else {
            alertFn({ title: 'Erreur de sauvegarde', message: 'Erreur lors de la sauvegarde : ' + e.message });
        }
        return false;
    }
};
