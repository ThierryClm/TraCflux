import React from 'react';
import type { ActionAPlage, ContexteIncrustations } from './contexteIncrustations';
import { instantPointDeRepos, instantRepereFixe, type InstantAction } from './instantsActions';
import { entier } from '../../../utils/entier';

interface FlechesRegleActionsProps {
    ctx: ContexteIncrustations;
    instantCoActions: ActionAPlage[];
    pointReposActions: ActionAPlage[];
    synchroBtsActions: ActionAPlage[];
}

// La flèche loge sous les graduations, sa pointe juste au-dessus du filet de la barre.
const LONGUEUR_TRAIT = 10;
const LARGEUR_POINTE = 5;
const HAUTEUR_POINTE = LARGEUR_POINTE * 1.5;
const DEMI_LARGEUR_PRISE = 6;

/**
 * Flèches du haut des points de repos, synchros BTS et instants Co. Posées dans
 * la barre des secondes, elles restent en vue quand les lignes défilent ; celles
 * du bas accompagnent toujours le groupe qui ferme la plage.
 */
const FlechesRegleActions = ({ ctx, instantCoActions, pointReposActions, synchroBtsActions }: FlechesRegleActionsProps) => {
    const { pixelsPerSecond, RULER_HEIGHT, totalWidth, hoveredActionId, setHoveredActionId, handleActionDragStart } = ctx;

    const pointeY = RULER_HEIGHT - 1;
    const baseY = pointeY - HAUTEUR_POINTE;
    const departY = baseY - LONGUEUR_TRAIT;

    const dessiner = (action: ActionAPlage, instant: InstantAction, couleur: string, famille: string, index: number) => {
        if (instant === null) return null;
        const xPos = instant * pixelsPerSecond;

        return (
            <svg
                key={`${famille}-${index}`}
                className={`fleche-regle fleche-regle-${famille} ${hoveredActionId === action.id ? 'highlighted' : ''}`}
                width={totalWidth}
                height={RULER_HEIGHT}
                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
            >
                <line x1={xPos} y1={departY} x2={xPos} y2={baseY} stroke={couleur} strokeWidth="2" />
                <polygon
                    points={`${xPos - LARGEUR_POINTE},${baseY} ${xPos + LARGEUR_POINTE},${baseY} ${xPos},${pointeY}`}
                    fill={couleur}
                />
                {/* Zone invisible de survol et de glissement */}
                <rect
                    x={xPos - DEMI_LARGEUR_PRISE}
                    y={departY}
                    width={DEMI_LARGEUR_PRISE * 2}
                    height={pointeY - departY}
                    fill="transparent"
                    style={{ pointerEvents: 'auto', cursor: 'ew-resize' }}
                    onMouseEnter={() => setHoveredActionId(action.id)}
                    onMouseLeave={() => setHoveredActionId(null)}
                    onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', entier(action.deb) || 0)}
                />
            </svg>
        );
    };

    return (
        <>
            {pointReposActions.map((action, idx) => dessiner(action, instantPointDeRepos(ctx, action), '#ff0000', 'repos', idx))}
            {synchroBtsActions.map((action, idx) => dessiner(action, instantRepereFixe(ctx, action), '#0000FF', 'bts', idx))}
            {instantCoActions.map((action, idx) => dessiner(action, instantRepereFixe(ctx, action), '#FF8C00', 'instant-co', idx))}
        </>
    );
};

export default FlechesRegleActions;
