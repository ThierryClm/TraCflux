/**
 * Navigateurs sans fenêtres natives Ouvrir / Enregistrer de l'API d'accès
 * aux fichiers : Firefox, Safari, Brave (qui les masque), Chrome sur Android — et un cadre d'un autre
 * site, où cadreTiers les a remplacées ou masquées.
 *
 * Sans elles, « Ouvrir un projet » renvoyait vers le cache du navigateur et
 * « Sauvegarder » n'écrivait que dans ce cache : aucun fichier n'était lu ni
 * produit.
 *
 * - Ouvrir : sélecteur de fichier classique (cf. cadreTiers).
 * - Enregistrer : téléchargement du fichier, sous le nom proposé. Le dossier
 *   est celui des téléchargements, ou celui que le navigateur demande.
 *
 * Les deux rendent des handles de même forme que l'API : les appelants ne
 * changent pas.
 */
import { ouvrirParSelecteurClassique } from './cadreTiers';

/** Type MIME du premier type demandé, sinon binaire générique. */
const typeMime = (options?: FilePickerOptionsLike): string =>
    Object.keys(options?.types?.[0]?.accept || {})[0] || 'application/octet-stream';

/** Lance le téléchargement d'un contenu sous un nom donné. */
export const telecharger = (contenu: Blob, nom: string, doc: Document = document): void => {
    const url = URL.createObjectURL(contenu);
    const lien = doc.createElement('a');
    lien.href = url;
    lien.download = nom;
    lien.style.display = 'none';
    doc.body.appendChild(lien);
    lien.click();
    lien.remove();
    // Firefox lit l'adresse après le clic : la libérer tout de suite
    // annulerait le téléchargement.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * showSaveFilePicker par téléchargement : le handle accumule ce qu'on y écrit
 * et le télécharge à la fermeture. getFile relit ce contenu, pour la
 * vérification « fichier non vide » des appelants.
 */
export const enregistrerParTelechargement = (options?: FilePickerOptionsLike, doc: Document = document): Promise<FileSystemFileHandleLike> => {
    const nom = options?.suggestedName || 'fichier';
    const type = typeMime(options);
    let ecrit = new File([], nom, { type });
    return Promise.resolve({
        name: nom,
        getFile: () => Promise.resolve(ecrit),
        createWritable: () => {
            const morceaux: BlobPart[] = [];
            return Promise.resolve({
                write: (contenu: string | Blob | BufferSource) => { morceaux.push(contenu as BlobPart); return Promise.resolve(); },
                close: () => {
                    ecrit = new File(morceaux, nom, { type });
                    telecharger(ecrit, nom, doc);
                    return Promise.resolve();
                }
            });
        }
    });
};

/** Remplace les fenêtres absentes ; renvoie celles qui ont été remplacées. */
export const adapterSelecteursSansAPI = (fenetre: Window = window): string[] => {
    const remplaces: string[] = [];
    if (!fenetre.showOpenFilePicker) {
        Object.defineProperty(fenetre, 'showOpenFilePicker', {
            value: (options?: FilePickerOptionsLike) => ouvrirParSelecteurClassique(options, fenetre.document),
            configurable: true, writable: true
        });
        remplaces.push('showOpenFilePicker');
    }
    if (!fenetre.showSaveFilePicker) {
        Object.defineProperty(fenetre, 'showSaveFilePicker', {
            value: (options?: FilePickerOptionsLike) => enregistrerParTelechargement(options, fenetre.document),
            configurable: true, writable: true
        });
        remplaces.push('showSaveFilePicker');
    }
    return remplaces;
};
