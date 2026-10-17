/**
 * Cache des projets dans le navigateur (clés traffic_project_<nom>) : ordre
 * des projets récents, liste, lecture et suppression. Appelé par
 * useTrafficLight.
 */
import { safeLocalStorage } from './stockageLocal';
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
