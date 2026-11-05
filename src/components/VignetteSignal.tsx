import SignalModule from './SignalModule';
import { ROUGE_SIGNAL } from '../utils/aspectSignal';

/** Le même module que sur le carrefour, allumé et immobile pour l'identifier. */
const VignetteSignal = ({ code, courant }: { code: string; courant?: string }) => (
    <span className="signal-select-icon" aria-hidden="true">
        <SignalModule code={code} courant={courant} couleur={code === 'R24' || code === 'R25' ? ROUGE_SIGNAL : 'rgb(0, 255, 0)'}
            temps={0} enLecture={false} a13bAllume />
    </span>
);

export default VignetteSignal;
