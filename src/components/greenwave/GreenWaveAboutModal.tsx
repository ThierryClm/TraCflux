import { APP_NAME, APP_VERSION, APP_DESCRIPTION } from '../../version';

interface GreenWaveAboutModalProps {
    onClose: () => void;
    /** Mentions de licence et de code source (fenêtre de travail, pas l'écran d'accueil). */
    showCredits?: boolean;
}

/** Modale « À propos » de la fenêtre Onde verte (équivalent simplifié de celle de l'application principale). */
const GreenWaveAboutModal = ({ onClose, showCredits = false }: GreenWaveAboutModalProps) => (
    <div className="gw-about-overlay" onClick={onClose}>
        <div className="gw-about-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', position: 'relative' }}>
                <img
                    src="./logo.svg"
                    alt=""
                    style={{ position: 'absolute', top: '0', right: '0', width: '80px', height: '80px', userSelect: 'none', pointerEvents: 'none' }}
                />
                <div style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#4ecdc4', marginBottom: '8px' }}>
                    {APP_NAME}
                </div>
                <div style={{ fontSize: '1.1em', color: '#aaa', marginBottom: '4px' }}>
                    Version {APP_VERSION}
                </div>
                <div style={{ fontSize: '0.9em', color: '#888', marginBottom: '20px', maxWidth: '420px', margin: '0 auto 20px' }}>
                    {APP_DESCRIPTION}
                </div>
                <div style={{ fontSize: '0.95em', marginBottom: '16px' }}>
                    <div>Module <strong>Onde verte</strong></div>
                    <div style={{ marginTop: '4px', color: '#aaa' }}>Conception d'ondes vertes bidirectionnelles modérantes</div>
                </div>
                {showCredits && (
                    <>
                        <hr style={{ border: 'none', borderTop: '1px solid #444', margin: '16px 0' }} />
                        <div style={{ fontSize: '0.85em', color: '#888', lineHeight: '1.6' }}>
                            <div>Développée avec <strong>React</strong> + <strong>Vite</strong></div>
                            <div style={{ marginTop: '8px' }}>© 2026 Thierry Colmon</div>
                            <div style={{ marginTop: '12px' }}>
                                Licence{' '}
                                <a
                                    href="https://www.gnu.org/licenses/agpl-3.0.html"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#4ecdc4' }}
                                >
                                    GNU AGPL v3
                                </a>
                            </div>
                            <div style={{ marginTop: '4px' }}>
                                Code source :{' '}
                                <a
                                    href="https://github.com/ThierryClm/TraCflux"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#4ecdc4' }}
                                >
                                    github.com/ThierryClm/TraCflux
                                </a>
                            </div>
                        </div>
                    </>
                )}
                <button
                    className="gw-about-close"
                    onClick={onClose}
                    style={{ marginTop: showCredits ? '20px' : '12px' }}
                >
                    Fermer
                </button>
            </div>
        </div>
    </div>
);

export default GreenWaveAboutModal;
