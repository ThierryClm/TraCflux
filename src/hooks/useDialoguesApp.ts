/**
 * États des fenêtres de dialogue d'App : gestion des utilisateurs, aide,
 * à propos, rapport de diagnostic, comparateur de capacité, ouverture et
 * import de projets, onde verte. Déplacés d'App.tsx tels quels.
 */
import { useState } from 'react';
import type { Projet } from '../types/projet';
import type { ViewerIntersection } from '../components/GreenWaveViewer';

const useDialoguesApp = () => {
    // État pour le modal de gestion des utilisateurs
    const [showUserManager, setShowUserManager] = useState(false);

    // Anchor à atteindre dans la modale d'aide (alimenté par l'URL ?openHelp=…).
    // Passé à <HelpContent /> via la prop initialAnchor.
    const [helpAnchor, setHelpAnchor] = useState<string | null>(null);
    const [aboutModal, setAboutModal] = useState(false);
    const [diagnosticModal, setDiagnosticModal] = useState(false);
    const [capacityCompareModal, setCapacityCompareModal] = useState(false);
    const [diagnosticIncludeProject, setDiagnosticIncludeProject] = useState(false);
    // Noms masqués par défaut : un rapport est destiné à une issue publique,
    // et ces noms désignent une commune et des rues réelles.
    const [diagnosticMaskNames, setDiagnosticMaskNames] = useState(true);
    const [diagnosticRefresh, setDiagnosticRefresh] = useState(0);

    // Ouverture d'un projet, import, export et copie de matrice.
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importError, setImportError] = useState('');
    const [importHintDir, setImportHintDir] = useState('');
    const [showExportPfModal, setShowExportPfModal] = useState(false);
    const [showCopyMatrixModal, setShowCopyMatrixModal] = useState(false);
    // Projet dont on importe les plans de feux, en attente des options d'import.
    const [importPfData, setImportPfData] = useState<{ name: string; state: Projet } | null>(null);

    // Green wave data states
    const [selectedGreenWave, setSelectedGreenWave] = useState<string | null>(null);
    const [greenWaveData, setGreenWaveData] = useState<ViewerIntersection[] | null>(null);
    const [, setGreenWaveListKey] = useState(0);

    return {
        showUserManager, setShowUserManager,
        helpAnchor, setHelpAnchor,
        aboutModal, setAboutModal,
        diagnosticModal, setDiagnosticModal,
        capacityCompareModal, setCapacityCompareModal,
        diagnosticIncludeProject, setDiagnosticIncludeProject,
        diagnosticMaskNames, setDiagnosticMaskNames,
        diagnosticRefresh, setDiagnosticRefresh,
        selectedProject, setSelectedProject,
        importFile, setImportFile,
        importError, setImportError,
        importHintDir, setImportHintDir,
        showExportPfModal, setShowExportPfModal,
        showCopyMatrixModal, setShowCopyMatrixModal,
        importPfData, setImportPfData,
        selectedGreenWave, setSelectedGreenWave,
        greenWaveData, setGreenWaveData,
        setGreenWaveListKey
    };
};

export default useDialoguesApp;
