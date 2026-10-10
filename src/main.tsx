import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import GreenWavePage from './GreenWavePage'
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

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("L'élément racine #root est introuvable.");
}

createRoot(rootElement).render(
    <StrictMode>
        <ConfirmProvider>
            <MicroVariablesProvider>
                {isGreenWavePage ? <GreenWavePage /> : <App />}
                <ReloadPrompt />
            </MicroVariablesProvider>
        </ConfirmProvider>
    </StrictMode>,
)
