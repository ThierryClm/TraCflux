import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
    REF_ARROW_SIZE, REF_IMAGE_BOX_WIDTH, REF_IMAGE_BOX_HEIGHT, planFrameForBubble
} from './phasageLayout';
import { ARROW_SIZE } from './floatingImageBox';

/**
 * Le cadre de référence des flèches, et la règle des 12,8 %.
 *
 * L'image du carrefour fait foi : c'est là que l'utilisateur règle rotation,
 * zoom, longueur et retour de chaque flèche. Partout ailleurs — bulles de
 * phasage, dossier imprimé — le cadre reprend sa forme et la flèche garde la
 * même part de sa largeur, soit 96 / 750 = 12,8 %.
 *
 * `phasageLayout` tient cette règle par construction : tout y dérive d'un
 * facteur unique. Le risque est à la frontière, car trois constantes y sont
 * RECOPIÉES depuis deux autres fichiers, et le commentaire du module se borne
 * à demander de « les garder d'accord ». Une consigne dans un commentaire est
 * un vœu, pas un garde-fou : ces tests en font une contrainte.
 *
 * Sans eux, élargir le cadre du carrefour dans la feuille de style
 * désaccorderait silencieusement les bulles et l'impression — le défaut qui a
 * coûté deux jours début septembre 2026.
 */

const css = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'components', 'IntersectionImage.css'),
    'utf8'
);

/** Une dimension déclarée dans la règle `.intersection-image-area`. */
const dimensionDuCadre = (propriete) => {
    const regle = css.match(/\.intersection-image-area\s*\{([^}]*)\}/);
    const valeur = regle && regle[1].match(new RegExp(`(?:^|;|\\s)${propriete}:\\s*(\\d+)px`));
    return valeur ? Number(valeur[1]) : null;
};

describe('Cadre de référence — accord avec ses sources', () => {
    it("la flèche de référence est celle de l'image du carrefour", () => {
        expect(
            REF_ARROW_SIZE,
            'REF_ARROW_SIZE a divergé de ARROW_SIZE : les flèches des bulles et du dossier '
            + 'imprimé ne seront plus aux proportions du plan'
        ).toBe(ARROW_SIZE);
    });

    it('le cadre de référence est celui déclaré dans la feuille de style', () => {
        expect(dimensionDuCadre('width'), '.intersection-image-area sans largeur en px').not.toBeNull();
        expect(
            REF_IMAGE_BOX_WIDTH,
            'REF_IMAGE_BOX_WIDTH a divergé de la largeur de .intersection-image-area'
        ).toBe(dimensionDuCadre('width'));
        expect(
            REF_IMAGE_BOX_HEIGHT,
            'REF_IMAGE_BOX_HEIGHT a divergé de la hauteur de .intersection-image-area'
        ).toBe(dimensionDuCadre('height'));
    });
});

describe('Règle des 12,8 % — la flèche garde sa part du cadre', () => {
    const PART = REF_ARROW_SIZE / REF_IMAGE_BOX_WIDTH;

    it('la part de référence vaut bien 12,8 %', () => {
        expect(PART).toBeCloseTo(0.128, 3);
    });

    // De la vignette à la pleine page : la règle ne doit dépendre d'aucune taille.
    [[120, 85], [300, 212], [570, 403], [750, 530], [900, 636], [1400, 990], [2000, 1414]]
        .forEach(([l, h]) => {
            it(`une bulle de ${l}×${h} garde la flèche à 12,8 % de son cadre`, () => {
                const { frameWidth, arrowSize } = planFrameForBubble(l, h);
                expect(arrowSize / frameWidth).toBeCloseTo(PART, 2);
            });
        });

    it('le cadre reste homothétique à celui du carrefour, quelle que soit la bulle', () => {
        const rapport = REF_IMAGE_BOX_WIDTH / REF_IMAGE_BOX_HEIGHT;
        // Une bulle carrée, une très large, une très haute : le cadre inscrit
        // doit garder le rapport du plan, sans quoi les flèches ne tomberaient
        // pas au même endroit dans la bulle et sur le plan.
        [[400, 400], [1200, 300], [300, 1200]].forEach(([l, h]) => {
            const { frameWidth, frameHeight } = planFrameForBubble(l, h);
            expect(frameWidth / frameHeight).toBeCloseTo(rapport, 2);
        });
    });

    it('le cadre tient toujours dans la bulle qu\'on lui donne', () => {
        [[400, 400], [1200, 300], [300, 1200], [570, 403]].forEach(([l, h]) => {
            const { frameWidth, frameHeight } = planFrameForBubble(l, h);
            expect(frameWidth).toBeLessThanOrEqual(l + 1);
            expect(frameHeight).toBeLessThanOrEqual(h + 1);
        });
    });

    it('agrandir la bulle agrandit la flèche dans la même proportion', () => {
        const petit = planFrameForBubble(375, 265);
        const grand = planFrameForBubble(750, 530);
        expect(grand.arrowSize / petit.arrowSize).toBeCloseTo(2, 1);
        expect(grand.facteur / petit.facteur).toBeCloseTo(2, 5);
    });
});
