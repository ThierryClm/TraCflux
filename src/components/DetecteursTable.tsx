import LocalInput from './LocalInput';
import { useConfirm } from './ConfirmProvider';
import { MentionVerrou, ZoneVerrouSaisie } from '../utils/verrouSaisie';
import {
    CATEGORIES_DETECTEUR,
    changerCategorie,
    creerDetecteur,
    descriptionDimension,
    dimensionDepuisSaisie,
    dimensionSaisissable,
    dupliquerDetecteur,
    LARGEUR_VOIE_REFERENCE_M,
    normaliserPixelsParMetre
} from '../utils/detecteurs';
import type { CategorieDetecteur, Detecteur, Groupe } from '../types/projet';
import './DetecteursTable.css';

interface DetecteursTableProps {
    detecteurs: Detecteur[];
    groups: Groupe[];
    onChange: (detecteurs: Detecteur[]) => void;
    /** Échelle de l'image : pixels par mètre. */
    pixelsParMetre: number;
    onPixelsParMetreChange: (valeur: number) => void;
    onDetach?: () => void;
    /** En fenêtre détachée, le bandeau porte déjà le titre. */
    titreEnBandeau?: boolean;
}

/** Tableau de saisie des détecteurs de terrain (onglet Détecteurs). */
const DetecteursTable = ({
    detecteurs,
    groups,
    onChange,
    pixelsParMetre,
    onPixelsParMetreChange,
    onDetach,
    titreEnBandeau = false
}: DetecteursTableProps) => {
    const askConfirm = useConfirm();

    const remplacer = (id: number, updates: Partial<Detecteur>) => {
        onChange(detecteurs.map(d => (d.id === id ? { ...d, ...updates } : d)));
    };

    const ajouter = () => {
        onChange([...detecteurs, creerDetecteur(detecteurs)]);
    };

    const dupliquer = (id: number) => {
        onChange(dupliquerDetecteur(detecteurs, id));
    };

    const supprimer = async (detecteur: Detecteur) => {
        const ok = await askConfirm({
            title: 'Supprimer le détecteur',
            message: `Supprimer « ${detecteur.nom.trim() || 'ce détecteur'} » ?`,
            confirmLabel: 'Supprimer',
            danger: true
        });
        if (ok) onChange(detecteurs.filter(d => d.id !== detecteur.id));
    };

    const libelleGroupe = (id: number): string => {
        const groupe = groups.find(g => g.id === id);
        if (!groupe) return `G${id}`;
        return groupe.name.trim() ? `G${id} — ${groupe.name}` : `G${id}`;
    };

    return (
        <ZoneVerrouSaisie section="detecteurs">
            <div className="detecteurs-container">
                {!titreEnBandeau && (
                    <h3 className="detecteurs-titre">
                        Détecteurs <MentionVerrou section="detecteurs" />
                        {onDetach && (
                            <button
                                className="detach-btn"
                                data-verrou-autorise
                                onClick={onDetach}
                                title="Détacher dans une fenêtre séparée"
                            >
                                Détacher
                            </button>
                        )}
                    </h3>
                )}

                <div className="detecteurs-echelle">
                    <label>Échelle de l'image : 1 m =</label>
                    <LocalInput
                        className="input-pixels-metre"
                        aria-label="Pixels par mètre"
                        value={pixelsParMetre}
                        onCommit={(valeur) => onPixelsParMetreChange(normaliserPixelsParMetre(valeur))}
                    />
                    <span>px</span>
                    <span className="detecteurs-echelle-note">
                        voie de {LARGEUR_VOIE_REFERENCE_M} m ≈ {Math.round(pixelsParMetre * LARGEUR_VOIE_REFERENCE_M)} px
                    </span>
                </div>

                <table className="detecteurs-table">
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>Type</th>
                            <th title="Groupe de feu concerné">GF</th>
                            <th title="Longueur d’une boucle, en mètres">Dim. (m)</th>
                            <th aria-label="Actions" />
                        </tr>
                    </thead>
                    <tbody>
                        {detecteurs.map(d => {
                            const sansDimension = !dimensionSaisissable(d.categorie);
                            return (
                                <tr key={d.id}>
                                    <td>
                                        <LocalInput
                                            className="input-nom-detecteur"
                                            aria-label="Nom du détecteur"
                                            value={d.nom}
                                            onCommit={(valeur) => remplacer(d.id, { nom: valeur })}
                                            selectOnFocus={/^Détecteur \d+$/.test(d.nom)}
                                        />
                                    </td>
                                    <td>
                                        <select
                                            className="input-categorie-detecteur"
                                            aria-label="Type du détecteur"
                                            value={d.categorie}
                                            onChange={(e) => {
                                                const categorie = e.target.value as CategorieDetecteur;
                                                onChange(detecteurs.map(x => (x.id === d.id ? changerCategorie(x, categorie) : x)));
                                            }}
                                        >
                                            {CATEGORIES_DETECTEUR.map(c => (
                                                <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <select
                                            className="input-gf-detecteur"
                                            aria-label="Groupe de feu du détecteur"
                                            value={d.gf === null ? '' : String(d.gf)}
                                            onChange={(e) => remplacer(d.id, {
                                                gf: e.target.value === '' ? null : Number(e.target.value)
                                            })}
                                        >
                                            <option value="">— Aucun —</option>
                                            {groups.map(g => (
                                                <option key={g.id} value={g.id}>{libelleGroupe(g.id)}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <LocalInput
                                            className="input-dimension-detecteur"
                                            aria-label="Dimension du détecteur"
                                            value={dimensionSaisissable(d.categorie) ? (d.dimension ?? '') : ''}
                                            onCommit={(valeur) => remplacer(d.id, {
                                                dimension: dimensionDepuisSaisie(valeur, d.categorie)
                                            })}
                                            disabled={!dimensionSaisissable(d.categorie)}
                                            placeholder={sansDimension ? '—' : ''}
                                            title={descriptionDimension(d.categorie)}
                                        />
                                    </td>
                                    <td className="col-actions">
                                        <button
                                            className="btn-dupliquer-detecteur"
                                            onClick={() => dupliquer(d.id)}
                                            title="Dupliquer ce détecteur"
                                        >
                                            ⧉
                                        </button>
                                        <button
                                            className="btn-supprimer-detecteur"
                                            onClick={() => { void supprimer(d); }}
                                            title="Supprimer ce détecteur"
                                        >
                                            ×
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {detecteurs.length === 0 && (
                    <p className="detecteurs-vide">
                        Aucun détecteur. Ajoutez-en un avec le bouton ci-dessous.
                    </p>
                )}

                <button className="btn-ajouter-detecteur" onClick={ajouter}>
                    + Ajouter un détecteur
                </button>

                <p className="detecteurs-note">
                    Les boucles font 1 m de large : seule leur longueur se saisit.
                    La boucle de comptage est proposée à 2 m, posée après le carrefour.
                </p>
            </div>
        </ZoneVerrouSaisie>
    );
};

export default DetecteursTable;
