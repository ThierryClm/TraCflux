import type { RecentGreenWave } from '../../utils/greenWaveStorage';

interface GreenWaveRestoreModalProps {
    entries: RecentGreenWave[];
    selectedName: string | null;
    onSelect: (name: string) => void;
    onRestore: (name: string) => void;
    onClose: () => void;
}

const formatDate = (iso: string | undefined): string => {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return '—';
    }
};

/**
 * Modale « Restaurer un projet récent » : ondes vertes du cache du navigateur,
 * alimenté par l'enregistrement automatique. Double-clic ou « Restaurer ».
 */
const GreenWaveRestoreModal = ({ entries, selectedName, onSelect, onRestore, onClose }: GreenWaveRestoreModalProps) => (
    <div className="gw-about-overlay" onClick={onClose}>
        <div className="gw-about-modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: '500px', maxWidth: '700px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#4ecdc4' }}>Restaurer un projet récent</h3>
            {entries.length === 0 ? (
                <div style={{ color: '#aaa', padding: '20px', textAlign: 'center' }}>
                    Aucune onde verte sauvegardée dans le cache navigateur.
                </div>
            ) : (
                <div style={{ maxHeight: '50vh', overflowY: 'auto', border: '1px solid #555', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                        <thead>
                            <tr style={{ background: '#444', color: '#eee' }}>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Nom</th>
                                <th style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Carrefours</th>
                                <th style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Modifié le</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry) => (
                                <tr
                                    key={entry.name}
                                    onClick={() => onSelect(entry.name)}
                                    onDoubleClick={() => onRestore(entry.name)}
                                    style={{
                                        background: selectedName === entry.name ? '#3a5d6a' : 'transparent',
                                        color: '#e0e0e0',
                                        cursor: 'pointer',
                                        borderTop: '1px solid #444'
                                    }}
                                >
                                    <td style={{ padding: '6px 8px' }}>{entry.name}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{entry.count}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap', color: '#aaa' }}>{formatDate(entry.savedAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                    onClick={onClose}
                    style={{ background: '#555', color: '#fff', border: '1px solid #666', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Annuler
                </button>
                <button
                    onClick={() => selectedName && onRestore(selectedName)}
                    disabled={!selectedName}
                    style={{
                        background: selectedName ? '#4ecdc4' : '#3a3a3a',
                        color: selectedName ? '#1e1e1e' : '#666',
                        border: '1px solid ' + (selectedName ? '#3aaca4' : '#444'),
                        padding: '6px 16px',
                        borderRadius: '4px',
                        cursor: selectedName ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold'
                    }}
                >
                    Restaurer
                </button>
            </div>
        </div>
    </div>
);

export default GreenWaveRestoreModal;
