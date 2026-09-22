/**
 * L'API d'accès aux fichiers du navigateur, telle que ce dépôt l'utilise.
 *
 * `showOpenFilePicker`, `showSaveFilePicker` et `showDirectoryPicker` ne
 * figurent pas dans la bibliothèque standard de TypeScript : la spécification
 * n'est pas encore stabilisée, et Firefox ne les implémente pas. Ce sont
 * pourtant elles qui ouvrent et enregistrent les projets, et l'application les
 * appelle déjà derrière des gardes (`safeShowOpenFilePicker` et consorts).
 *
 * Ce fichier ne décrit QUE ce qui est réellement appelé ici, plutôt que
 * d'ajouter une dépendance pour la spécification entière. C'est une
 * déclaration : aucun code n'en sort, rien n'est embarqué dans l'application.
 */

interface FileSystemFileHandleLike {
    name: string;
    /** Non standard, encore présent dans Chrome : le répertoire du fichier. */
    getParent?(): Promise<FileSystemDirectoryHandleLike | null>;
    getFile(): Promise<File>;
    createWritable(): Promise<{
        write(contenu: string | Blob | BufferSource): Promise<void>;
        close(): Promise<void>;
    }>;
}

interface FileSystemDirectoryHandleLike {
    name: string;
    getFileHandle(nom: string, options?: { create?: boolean }): Promise<FileSystemFileHandleLike>;
    queryPermission?(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission?(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

/** Options communes aux trois sélecteurs. `startIn` accepte un répertoire mémorisé. */
interface FilePickerOptionsLike {
    types?: { description?: string; accept: Record<string, string[]> }[];
    multiple?: boolean;
    suggestedName?: string;
    excludeAcceptAllOption?: boolean;
    startIn?: FileSystemDirectoryHandleLike | string;
    id?: string;
}

interface Window {
    showOpenFilePicker?(options?: FilePickerOptionsLike): Promise<FileSystemFileHandleLike[]>;
    showSaveFilePicker?(options?: FilePickerOptionsLike): Promise<FileSystemFileHandleLike>;
    showDirectoryPicker?(options?: FilePickerOptionsLike): Promise<FileSystemDirectoryHandleLike>;
}
