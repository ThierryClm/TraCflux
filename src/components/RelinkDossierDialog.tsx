import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import './RelinkDossierDialog.css';
import { useAlert, useConfirm } from './ConfirmProvider';
import { safeShowOpenFilePicker } from '../utils/filePicker';
import { validateProject } from '../utils/projectValidator';
import {
    relinkIntersection,
    type GreenWaveIntersection,
    type GroupReport,
    type ProjectLike,
    type RelinkReport
} from '../utils/greenWaveRelink';

/**
 * Fenêtre « Changer de dossier… » d'un carrefour de l'onde verte.
 *
 * Étape 1 : choix du dossier, dans le cache du navigateur ou sur le disque
 * (le fichier est alors mis en cache, comme dans « Nouveau », pour que la
 * synchronisation le retrouve ensuite). Étape 2 : récapitulatif de ce qui
 * change avant validation.
 */

interface RelinkDossierDialogProps {
    intersection: GreenWaveIntersection | null;
    onClose: () => void;
    onConfirm: (updated: GreenWaveIntersection) => void;
    listProjects: () => string[];
    loadProjectData: (name: string) => ProjectLike | null;
}

interface Pending {
    projectName: string;
    updated: GreenWaveIntersection;
    report: RelinkReport;
}

const MATCH_TEXT: Record<GroupReport['match'], string> = {
    same: 'conservé',
    byName: 'retrouvé par son nom',
    byId: 'même numéro, nom différent : à vérifier',
    missing: 'introuvable : premier groupe choisi, à corriger dans le tableau'
};

const GroupLine = ({ label, group }: { label: string; group: GroupReport }) => (
    <li className={group.match === 'same' || group.match === 'byName' ? '' : 'relink-warning'}>
        {label} : {group.before}
        {group.after !== group.before && <> → {group.after}</>} ({MATCH_TEXT[group.match]})
    </li>
);

const RelinkDossierDialog = ({ intersection, onClose, onConfirm, listProjects, loadProjectData }: RelinkDossierDialogProps) => {
    const showAlert = useAlert();
    const askConfirm = useConfirm();
    const [projects, setProjects] = useState<string[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [pending, setPending] = useState<Pending | null>(null);

    useEffect(() => {
        if (!intersection) return;
        setProjects(listProjects());
        setSelected(null);
        setPending(null);
        // listProjects est recréée à chaque rendu du parent : seule l'ouverture compte.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intersection]);

    if (!intersection) return null;

    const prepare = (projectName: string, project: ProjectLike) => {
        const { intersection: updated, report } = relinkIntersection(intersection, projectName, project);
        setPending({ projectName, updated, report });
    };

    const handlePickCached = (name: string | null) => {
        if (!name) return;
        const project = loadProjectData(name);
        if (!project) {
            showAlert({ title: 'Chargement impossible', message: `Impossible de charger le dossier « ${name} ».` });
            return;
        }
        prepare(name, project);
    };

    const handleBrowseFile = async () => {
        try {
            const [fileHandle] = await safeShowOpenFilePicker({
                types: [{ description: 'Projet TraCflux (.json)', accept: { 'application/json': ['.json'] } }],
                multiple: false
            });
            const file = await fileHandle.getFile();
            const text = await file.text();
            if (!text || text.trim() === '') {
                showAlert({ title: 'Fichier vide', message: 'Le fichier sélectionné est vide.' });
                return;
            }
            let project: ProjectLike & { projectName?: string; intersectionName?: string };
            try {
                project = JSON.parse(text);
            } catch {
                showAlert({ title: 'JSON invalide', message: 'Le fichier sélectionné ne contient pas un JSON valide.' });
                return;
            }
            const validation = validateProject(project);
            if (!validation.ok) {
                showAlert({ title: 'Projet non reconnu', message: validation.error });
                return;
            }

            const projectName = project.projectName || project.intersectionName || file.name.replace(/\.json$/i, '');
            const storageKey = `traffic_project_${projectName}`;
            if (localStorage.getItem(storageKey)) {
                const ok = await askConfirm({
                    title: 'Dossier déjà en cache',
                    message: `Un dossier « ${projectName} » existe déjà dans le cache local.\n\nLe remplacer par celui chargé depuis « ${file.name} » ?`,
                    confirmLabel: 'Remplacer',
                    danger: true
                });
                if (!ok) return;
            }
            try {
                localStorage.setItem(storageKey, text);
                const order: string[] = JSON.parse(localStorage.getItem('traffic_project_order') || '[]');
                localStorage.setItem('traffic_project_order', JSON.stringify([projectName, ...order.filter(n => n !== projectName)]));
            } catch (storageErr) {
                showAlert({ title: 'Stockage insuffisant', message: 'Impossible de mettre ce dossier en cache : ' + storageErr.message });
                return;
            }
            prepare(projectName, project);
        } catch (e) {
            if (e.name !== 'AbortError') {
                showAlert({ title: "Erreur d'ouverture", message: "Erreur lors de l'ouverture du fichier : " + e.message });
            }
        }
    };

    const report = pending?.report;

    return (
        <Modal isOpen onClose={onClose} title={`Changer de dossier — ${intersection.projectName}`}>
            {!pending ? (
                <>
                    <p className="relink-hint">
                        Choisissez le dossier à relier à ce carrefour. Sa place dans l'onde verte et ses distances sont conservées.
                    </p>
                    {projects.length > 0 ? (
                        <div className="project-list-container">
                            <ul className="project-list">
                                {projects.map(name => (
                                    <li
                                        key={name}
                                        className={selected === name ? 'selected' : ''}
                                        onClick={() => setSelected(name)}
                                        onDoubleClick={() => handlePickCached(name)}
                                    >
                                        <span className="project-icon"></span>
                                        <div className="project-info-modal">
                                            <span className="project-name">
                                                {name}{name === intersection.projectName ? ' (actuel)' : ''}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <p className="relink-hint">Aucun dossier dans le cache du navigateur.</p>
                    )}
                    <div className="modal-actions">
                        <button className="modal-btn modal-btn-secondary" onClick={handleBrowseFile}>
                            Parcourir un fichier…
                        </button>
                        <button className="modal-btn modal-btn-secondary" onClick={onClose}>Annuler</button>
                        <button className="modal-btn modal-btn-primary" onClick={() => handlePickCached(selected)} disabled={!selected}>
                            Suivant
                        </button>
                    </div>
                </>
            ) : report && (
                <>
                    <ul className="relink-summary">
                        <li>Dossier : {report.projectBefore} → {report.projectAfter}</li>
                        <li className={report.pfKept ? '' : 'relink-warning'}>
                            Plan de feux : {report.pfKept ? `${report.pfAfter} (conservé)` : `${report.pfBefore} introuvable, ${report.pfAfter} choisi`}
                        </li>
                        <li className={report.cycleBefore === report.cycleAfter ? '' : 'relink-warning'}>
                            Cycle : {report.cycleBefore === report.cycleAfter ? `${report.cycleAfter} s (inchangé)` : `${report.cycleBefore} s → ${report.cycleAfter} s`}
                        </li>
                        <GroupLine label="GF descendant" group={report.descending} />
                        <GroupLine label="GF montant" group={report.ascending} />
                    </ul>
                    <div className="modal-actions">
                        <button className="modal-btn modal-btn-secondary" onClick={() => setPending(null)}>Retour</button>
                        <button className="modal-btn modal-btn-primary" onClick={() => onConfirm(pending.updated)}>
                            Relier ce dossier
                        </button>
                    </div>
                </>
            )}
        </Modal>
    );
};

export default RelinkDossierDialog;
