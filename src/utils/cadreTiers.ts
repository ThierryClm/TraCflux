/**
 * TraCflux affiché dans un cadre (iframe) d'un autre site — le panneau
 * Aperçu de Molted, par exemple. Le navigateur y refuse les fenêtres
 * natives de l'API d'accès aux fichiers : « Cross origin sub frames aren't
 * allowed to show a file picker ». Ouvrir un projet échouait.
 *
 * - « Ouvrir » : remplacé par le sélecteur de fichier classique
 *   (<input type="file">), autorisé dans un cadre. Il rend un fichier sous
 *   la même forme que l'API : les appelants ne changent pas.
 * - « Enregistrer sous » et « Choisir un dossier » : masqués. L'application
 *   prend alors le repli prévu pour les navigateurs qui ne les ont pas.
 */

/** Vrai si la page est dans un cadre dont le parent est d'une autre origine. */
export const dansCadreTiers = (fenetre: Window = window): boolean => {
    try {
        if (fenetre.self === fenetre.top) return false;
        // Lire l'adresse du parent lève une erreur s'il est d'une autre origine.
        void fenetre.top?.location.href;
        return false;
    } catch {
        return true;
    }
};

/** Extensions et types acceptés, au format de l'attribut accept d'un <input type="file">. */
export const acceptDesTypes = (options?: FilePickerOptionsLike): string =>
    (options?.types || [])
        .flatMap(type => Object.entries(type.accept).flatMap(([mime, extensions]) => [mime, ...extensions]))
        .join(',');

/** Fichier choisi, présenté comme un handle de l'API : lecture seule. */
const handleLectureSeule = (fichier: File): FileSystemFileHandleLike => ({
    name: fichier.name,
    getFile: () => Promise.resolve(fichier),
    createWritable: () => Promise.reject(new DOMException('Fichier ouvert en lecture seule.', 'NotAllowedError'))
});

/** showOpenFilePicker par le sélecteur classique ; rejette en AbortError si l'on annule. */
export const ouvrirParSelecteurClassique = (options?: FilePickerOptionsLike, doc: Document = document): Promise<FileSystemFileHandleLike[]> =>
    new Promise((resolve, reject) => {
        const champ = doc.createElement('input');
        champ.type = 'file';
        champ.accept = acceptDesTypes(options);
        champ.multiple = !!options?.multiple;
        champ.style.display = 'none';
        const finir = () => champ.remove();
        champ.addEventListener('change', () => {
            const fichiers = Array.from(champ.files || []);
            finir();
            if (fichiers.length === 0) reject(new DOMException('Aucun fichier choisi.', 'AbortError'));
            else resolve(fichiers.map(handleLectureSeule));
        });
        champ.addEventListener('cancel', () => {
            finir();
            reject(new DOMException('Sélection annulée.', 'AbortError'));
        });
        doc.body.appendChild(champ);
        champ.click();
    });

/** Adapte les sélecteurs de fichiers à un cadre tiers ; renvoie vrai si c'est le cas. */
export const adapterSelecteursDansCadreTiers = (fenetre: Window = window): boolean => {
    if (!dansCadreTiers(fenetre)) return false;
    if ('showOpenFilePicker' in fenetre) {
        Object.defineProperty(fenetre, 'showOpenFilePicker', {
            value: (options?: FilePickerOptionsLike) => ouvrirParSelecteurClassique(options, fenetre.document),
            configurable: true, writable: true
        });
    }
    for (const nom of ['showSaveFilePicker', 'showDirectoryPicker'] as const) {
        if (nom in fenetre) {
            Object.defineProperty(fenetre, nom, { value: undefined, configurable: true, writable: true });
        }
    }
    return true;
};
