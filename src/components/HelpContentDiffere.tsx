import { lazy, Suspense } from 'react';
import type { HelpContentProps } from './HelpContent';

// L'aide pèse environ 110 Ko, soit le plus gros composant de l'application :
// elle n'est chargée qu'à la première ouverture de la modale Aide. Le service
// worker la garde en cache, l'aide reste donc disponible hors ligne.
const HelpContent = lazy(() => import('./HelpContent'));

const HelpContentDiffere = (props: HelpContentProps) => (
    <Suspense fallback={<p className="help-chargement">Chargement de l’aide…</p>}>
        <HelpContent {...props} />
    </Suspense>
);

export default HelpContentDiffere;
