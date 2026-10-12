import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ConfirmProvider } from './components/ConfirmProvider'
import { MicroVariablesProvider } from './components/MicroVariablesProvider'
import ReloadPrompt from './components/ReloadPrompt'
import { initPrivacyFriendlyAnalytics } from './utils/analytics'
import { installErrorInterceptor } from './utils/errorInterceptor'
import './index.css'

installErrorInterceptor();
initPrivacyFriendlyAnalytics();

// Check URL parameters to decide which component to render
const urlParams = new URLSearchParams(window.location.search);
const isGreenWavePage = urlParams.has('greenwave');

// L'onde verte s'ouvre dans sa propre fenêtre : son code n'est chargé que là,
// et l'éditeur de carrefour démarre sans lui.
const GreenWavePage = lazy(() => import('./GreenWavePage'));

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("L'élément racine #root est introuvable.");
}

createRoot(rootElement).render(
    <StrictMode>
        <ConfirmProvider>
            <MicroVariablesProvider>
                {isGreenWavePage ? <Suspense fallback={null}><GreenWavePage /></Suspense> : <App />}
                <ReloadPrompt />
            </MicroVariablesProvider>
        </ConfirmProvider>
    </StrictMode>,
)
