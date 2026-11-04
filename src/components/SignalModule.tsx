import type { ReactElement } from 'react';
import { aspectSignal, ETEINT_SIGNAL } from '../utils/aspectSignal';
import type { ContexteSignal, DirectionSignal, FormeSignal } from '../utils/aspectSignal';

const CORPS = '#111111';
const VISIERE = '#ffffff';

/** Flèches d'un R14 ou d'un R16, tracées dans le carré de 32 du module. */
const Fleches = ({ direction, couleur, epaisseur = 2.4 }: { direction: DirectionSignal; couleur: string; epaisseur?: number }) => {
    const trait = { fill: 'none', stroke: couleur, strokeWidth: epaisseur, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
    switch (direction) {
        case 'd':
            return <g {...trait}><path d="M16,23.5 V10.5" /><polyline points="12,14.5 16,10.5 20,14.5" /></g>;
        case 'tg':
            return <g {...trait}><path d="M23,17 H9" /><polyline points="13,13 9,17 13,21" /></g>;
        case 'td':
            return <g {...trait}><path d="M9,17 H23" /><polyline points="19,13 23,17 19,21" /></g>;
        case 'dtg':
            return (
                <g {...trait}>
                    <path d="M18.5,24 V10" /><polyline points="15,13.5 18.5,10 22,13.5" />
                    <path d="M18.5,19 H9" /><polyline points="12,16 9,19 12,22" />
                </g>
            );
        case 'dtd':
            return (
                <g {...trait}>
                    <path d="M13.5,24 V10" /><polyline points="10,13.5 13.5,10 17,13.5" />
                    <path d="M13.5,19 H23" /><polyline points="20,16 23,19 20,22" />
                </g>
            );
    }
};

const Cycle = ({ couleur }: { couleur: string }) => (
    <g fill="none" stroke={couleur} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10.5" cy="20" r="3.2" fill={couleur} stroke="none" />
        <circle cx="21.5" cy="20" r="3.2" fill={couleur} stroke="none" />
        <polyline points="10.5,20 14,13.5 20,13.5 15.5,20 10.5,20" />
        <polyline points="21.5,20 19.5,11 22,11" />
        <path d="M12.5,13 H15.5" />
    </g>
);

const PietonMarche = ({ couleur }: { couleur: string }) => (
    <g fill="none" stroke={couleur} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16.5" cy="6.5" r="2.5" fill={couleur} stroke="none" />
        <path d="M16.5,11 L15.5,18.5" strokeWidth={4} />
        <polyline points="11.5,16 13.5,12 16.5,11 19.5,13.5 22,15" />
        <polyline points="15.5,18.5 13.5,23 10,27" />
        <polyline points="15.5,18.5 18.5,22.5 20.5,27" />
    </g>
);

const PietonArret = ({ couleur }: { couleur: string }) => (
    <g fill="none" stroke={couleur} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="6.5" r="2.5" fill={couleur} stroke="none" />
        <rect x="13.5" y="10.5" width="5" height="8" fill={couleur} stroke="none" rx="1" />
        <path d="M12,11.5 L11.5,18.5" />
        <path d="M20,11.5 L20.5,18.5" />
        <path d="M14.5,18 V27" />
        <path d="M17.5,18 V27" />
    </g>
);

/** Feu circulaire : visière blanche, puis lentille noire cerclée si elle porte un pictogramme. */
const Feu = ({ cerclee = true, children }: { cerclee?: boolean; children: ReactElement }) => (
    <>
        <rect x="2" y="2" width="28" height="28" rx="2" fill={CORPS} />
        <path d="M4.7,12.9 A12,12 0 0 1 27.3,12.9" fill="none" stroke={VISIERE} strokeWidth={1.4} strokeLinecap="round" />
        {cerclee && <circle cx="16" cy="17" r="9.8" fill="#000000" stroke={VISIERE} strokeWidth={0.6} />}
        {children}
    </>
);

/** Feu à silhouette : le pictogramme occupe tout le corps, sans lentille circulaire. */
const Figurine = ({ children }: { children: ReactElement }) => (
    <>
        <rect x="4" y="1" width="24" height="30" rx="2" fill={CORPS} />
        {children}
    </>
);

const dessins: Record<FormeSignal, (couleur: string, extra: { couleurStop?: string; direction?: DirectionSignal }) => ReactElement> = {
    disque: c => <Feu cerclee={false}><circle cx="16" cy="17" r="10" fill={c} /></Feu>,
    d: c => <Feu><Fleches direction="d" couleur={c} /></Feu>,
    tg: c => <Feu><Fleches direction="tg" couleur={c} /></Feu>,
    td: c => <Feu><Fleches direction="td" couleur={c} /></Feu>,
    dtg: c => <Feu><Fleches direction="dtg" couleur={c} /></Feu>,
    dtd: c => <Feu><Fleches direction="dtd" couleur={c} /></Feu>,
    bus: c => (
        <Feu>
            <text x="16" y="20" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="8.2" fontWeight="900" fill={c}>BUS</text>
        </Feu>
    ),
    cycle: c => <Feu><g transform="translate(0,-0.5)"><Cycle couleur={c} /></g></Feu>,
    'cycle-direction': (c, { direction = 'td' }) => (
        <Feu>
            <>
                <g transform="translate(7.2,3.6) scale(0.55)"><Cycle couleur={c} /></g>
                <g transform="translate(8,13.5) scale(0.5)"><Fleches direction={direction} couleur={c} epaisseur={2.8} /></g>
            </>
        </Feu>
    ),
    marche: c => <Figurine><PietonMarche couleur={c} /></Figurine>,
    arret: c => <Figurine><PietonArret couleur={c} /></Figurine>,
    'mixte-marche': c => (
        <Figurine>
            <>
                <g transform="translate(6.7,0.6) scale(0.58)"><PietonMarche couleur={c} /></g>
                <g transform="translate(4.4,10.5) scale(0.72)"><Cycle couleur={c} /></g>
            </>
        </Figurine>
    ),
    'mixte-arret': c => (
        <Figurine>
            <>
                <g transform="translate(6.7,0.6) scale(0.58)"><PietonArret couleur={c} /></g>
                <g transform="translate(4.4,10.5) scale(0.72)"><Cycle couleur={c} /></g>
            </>
        </Figurine>
    ),
    trait: c => <Figurine><rect x="14.5" y="5" width="3" height="22" rx="1" fill={c} /></Figurine>,
    stop: (c, { couleurStop = c }) => (
        <Figurine>
            <>
                <g transform="translate(5.6,-0.4) scale(0.65)"><PietonArret couleur={c} /></g>
                <text x="16" y="27" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="7.4" fontWeight="900" fill={couleurStop}>STOP</text>
            </>
        </Figurine>
    ),
    'barre-v': c => <Feu><rect x="14" y="10" width="4" height="14" rx="0.6" fill={c} /></Feu>,
    'barre-g': c => <Feu><rect x="14" y="10" width="4" height="14" rx="0.6" fill={c} transform="rotate(-30 16 17)" /></Feu>,
    'barre-d': c => <Feu><rect x="14" y="10" width="4" height="14" rx="0.6" fill={c} transform="rotate(30 16 17)" /></Feu>,
    'barre-h': c => <Feu><rect x="9" y="15" width="14" height="4" rx="0.6" fill={c} /></Feu>,
    point: c => <Feu><circle cx="16" cy="17" r="3.4" fill={c} /></Feu>,
    // Contour rouge constant et fond qui s'allume, comme le triangle du courant PP.
    a13b: c => (
        <>
            <polygon points="16,3 30,28 2,28" fill={c === ETEINT_SIGNAL ? '#000000' : c} stroke="#e00000" strokeWidth={2.2} strokeLinejoin="round" />
            <g transform="translate(9.6,7.4) scale(0.6)"><PietonMarche couleur={c === ETEINT_SIGNAL ? c : '#000000'} /></g>
        </>
    )
};

interface SignalModuleProps extends ContexteSignal {
    code: string;
}

/**
 * Un feu du signal ISR du groupe, vu de face, à la place de sa flèche. Même
 * carré de 32 que les flèches, pour hériter de leur échelle ; jamais de
 * rotation, un pictogramme se lit à l'endroit.
 */
const SignalModule = ({ code, ...contexte }: SignalModuleProps) => {
    const aspect = aspectSignal(code, contexte);
    if (!aspect) return null;
    return (
        <svg width={32} height={32} viewBox="0 0 32 32" role="img" aria-label={`Signal ${code}`} data-forme={aspect.forme}>
            {dessins[aspect.forme](aspect.couleur, aspect)}
        </svg>
    );
};

export default SignalModule;
