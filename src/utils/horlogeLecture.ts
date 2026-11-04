/**
 * Horloge de la lecture, indépendante de la visibilité de la fenêtre.
 *
 * La lecture avançait sur requestAnimationFrame, que le navigateur suspend pour
 * une fenêtre masquée, et un setInterval y est ralenti à une fois par seconde.
 * Or la fenêtre principale peut passer derrière l'image détachée, celle qu'on
 * regarde en présentation : plus rien n'avançait. Un worker n'a pas ces limites.
 */
const CODE_WORKER = 'onmessage = e => setInterval(() => postMessage(0), e.data);';

/** Appelle `tic` toutes les `periode` ms et rend la fonction qui l'arrête. */
export const demarrerHorloge = (periode: number, tic: () => void): (() => void) => {
    let url: string | undefined;
    try {
        url = URL.createObjectURL(new Blob([CODE_WORKER], { type: 'text/javascript' }));
        const worker = new Worker(url);
        worker.onmessage = tic;
        worker.postMessage(periode);
        return () => {
            worker.terminate();
            URL.revokeObjectURL(url as string);
        };
    } catch {
        // Worker indisponible : la lecture marche, sauf fenêtre masquée.
        if (url) URL.revokeObjectURL(url);
        const minuteur = setInterval(tic, periode);
        return () => clearInterval(minuteur);
    }
};
