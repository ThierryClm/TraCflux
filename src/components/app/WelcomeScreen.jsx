function WelcomeScreen({ hasActiveProject, showExampleInvite }) {
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
                </div>
            )}

        </>
    );
}

export default WelcomeScreen;
