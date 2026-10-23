interface WelcomeScreenProps {
    hasActiveProject: boolean;
    showExampleInvite: boolean;
}

function WelcomeScreen({ hasActiveProject, showExampleInvite }: WelcomeScreenProps) {
    return (
        <>
            {!hasActiveProject && (
                <div className="welcome-screen">
                    <p className="welcome-hint">
                        Commencez par <strong>Fichier → Nouveau projet</strong> ou <strong>Ouvrir un projet</strong>.
                    </p>
                    {showExampleInvite && (
                    <p className="welcome-hint">
                        Première visite ?{' '}
                        <button
                            type="button"
                            className="welcome-example-link"
                            onClick={() => window.open(`${window.location.pathname}?example=carrefour`, '_blank')}
                        >
                            Découvrir avec un projet exemple
                        </button>
                        {' '}(s'ouvre dans une nouvelle fenêtre).
                    </p>
                    )}
                    {showExampleInvite && (
                    <p className="welcome-hint">
                        {/* Lien suivi par les moteurs de recherche : l'accueil n'a
                            presque pas de texte, la page de présentation le porte. */}
                        <a className="welcome-example-link" href="presentation/" target="_blank" rel="noopener">
                            Qu'est-ce que TraCflux ?
                        </a>
                    </p>
                    )}
                </div>
            )}

        </>
    );
}

export default WelcomeScreen;
