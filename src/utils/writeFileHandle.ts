/**
 * Écriture d'un texte dans un fichier choisi par le sélecteur du navigateur.
 *
 * Chrome refuse parfois l'écriture avec une InvalidStateError (« the state had
 * changed since it was read from disk ») quand le fichier a bougé entre son
 * choix et son écriture. Cas typique : un nouveau fichier dans un dossier
 * OneDrive ou SharePoint, que le client de synchronisation touche aussitôt créé.
 * Le navigateur laisse alors un fichier vide, et la seconde tentative réussit.
 * On la fait donc à la place de l'utilisateur, puis on explique l'échec en
 * français si elle échoue aussi.
 */

/** Message affiché quand le fichier change encore pendant la seconde tentative. */
export const FILE_CHANGED_MESSAGE =
    'le fichier a été modifié par un autre programme pendant l\'enregistrement '
    + '(synchronisation OneDrive ou SharePoint ?). Réessaie, ou choisis un autre nom.';

/** Délai avant la nouvelle tentative, le temps que la synchronisation relâche le fichier. */
const RETRY_DELAY_MS = 300;

const isStaleStateError = (error: unknown): boolean =>
    (error as { name?: string } | null)?.name === 'InvalidStateError';

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function writeTextToFileHandle(
    fileHandle: FileSystemFileHandleLike,
    content: string,
    retries = 1
): Promise<void> {
    for (let attempt = 0; ; attempt++) {
        try {
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            return;
        } catch (error) {
            if (!isStaleStateError(error)) throw error;
            if (attempt >= retries) throw new Error(FILE_CHANGED_MESSAGE);
            console.warn('Écriture refusée (fichier modifié sur le disque), nouvelle tentative…');
            await wait(RETRY_DELAY_MS);
        }
    }
}
