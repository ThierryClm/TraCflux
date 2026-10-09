import { describe, it, expect, vi } from 'vitest';
import { lireMiseEnPage, appliquerMiseEnPage, affichageCommentairesRemarques } from './miseEnPageProjet';

const etatCourant = {
    diagramHeight: 640,
    floatingCrop: { top: 4, bottom: 8, left: 2, right: 6 },
    floatingZoom: 1.4,
    sidebarVisible: false,
    showComments: true,
    showRemarks: false,
    showActionDescription: true,
    showFloatingForm: true,
    showFloatingMatrix: false,
    showFloatingTraffic: true,
    showFloatingImage: false,
    showFloatingConditions: true,
    showFloatingVariables: false,
    showFloatingRemarks: true,
    showImageGroupNumbers: true,
    showImageGroupNames: false,
    showImageArrows: false,
    directoryNames: { open: 'Études', save: 'Études', import: null, image: 'Plans', greenWave: null }
};

// Un jeu de poseurs qui retient ce qu'on lui donne, plutôt que de le poser.
const poseurs = () => {
    const vus = {};
    const espion = (nom) => vi.fn((v) => { vus[nom] = v; });
    return {
        vus,
        s: {
            setDiagramHeight: espion('diagramHeight'),
            resetDiagramHeight: espion('resetHauteur'),
            setFloatingCrop: espion('crop'),
            setFloatingZoom: espion('zoom'),
            markLegacyCrop: espion('cropAncien'),
            setSidebarVisible: espion('panneau'),
            setShowComments: espion('commentaires'),
            setShowRemarks: espion('remarques'),
            setShowActionDescription: espion('description'),
            setShowFloatingForm: espion('formulaire'),
            setShowFloatingMatrix: espion('matrice'),
            setShowFloatingTraffic: espion('trafic'),
            setShowFloatingImage: espion('image'),
            setShowFloatingConditions: espion('conditions'),
            setShowFloatingVariables: espion('variables'),
            setShowFloatingRemarks: espion('remarquesDetachees'),
            setDossierSections: espion('dossier'),
            setShowImageGroupNumbers: espion('imageNumeros'),
            setShowImageGroupNames: espion('imageNoms'),
            setShowImageArrows: espion('imageFleches')
        }
    };
};

describe('miseEnPageProjet — aller-retour', () => {
    it('ce qui est lu est intégralement restitué', () => {
        const paquet = lireMiseEnPage(etatCourant);
        const { vus, s } = poseurs();
        appliquerMiseEnPage(paquet, s);

        expect(vus.diagramHeight).toBe(640);
        expect(vus.crop).toEqual({ top: 4, bottom: 8, left: 2, right: 6 });
        expect(vus.zoom).toBe(1.4);
        expect(vus.panneau).toBe(false);
        expect(vus.commentaires).toBe(true);
        expect(vus.remarques).toBe(false);
        expect(vus.description).toBe(true);
        expect(vus.formulaire).toBe(true);
        expect(vus.matrice).toBe(false);
        expect(vus.trafic).toBe(true);
        expect(vus.conditions).toBe(true);
        expect(vus.remarquesDetachees).toBe(true);
    });

    it('le paquet porte bien les six clés attendues du fichier', () => {
        const paquet = lireMiseEnPage(etatCourant);
        ['diagramHeight', 'floatingCrop', 'floatingCropBasis', 'floatingZoom',
            'layoutOptions', 'directoryNames'].forEach(k => expect(paquet).toHaveProperty(k));
    });

    it('le cadrage est marqué hérité quand sa base diffère', () => {
        const { vus, s } = poseurs();
        appliquerMiseEnPage({ floatingCrop: { top: 1 }, floatingCropBasis: 'boite' }, s);
        expect(vus.cropAncien).toBe(true);
    });
});

describe('miseEnPageProjet — projets antérieurs', () => {
    it('sans layoutOptions, repart d\'un espace de travail propre', () => {
        const { vus, s } = poseurs();
        appliquerMiseEnPage({ groups: [], pfTabs: [] }, s);
        expect(vus.panneau).toBe(true);
        ['formulaire', 'matrice', 'trafic', 'image', 'conditions', 'variables', 'remarquesDetachees']
            .forEach(k => expect(vus[k]).toBe(false));
    });

    it('sans layoutOptions, devine les commentaires d\'après leur présence', () => {
        const { vus, s } = poseurs();
        appliquerMiseEnPage({ groups: [{ comment: 'à vérifier' }], pfTabs: [] }, s);
        expect(vus.commentaires).toBe(true);
    });

    it('sans hauteur de diagramme, efface celle du projet précédent', () => {
        const { s } = poseurs();
        appliquerMiseEnPage({ layoutOptions: {} }, s);
        expect(s.resetDiagramHeight).toHaveBeenCalled();
        expect(s.setDiagramHeight).not.toHaveBeenCalled();
    });

    it('sans cases de dossier, garde celles en place', () => {
        const { s } = poseurs();
        appliquerMiseEnPage({ layoutOptions: {} }, s);
        expect(s.setDossierSections).not.toHaveBeenCalled();
    });

    it('un panneau absent des options est considéré comme affiché', () => {
        const { vus, s } = poseurs();
        appliquerMiseEnPage({ layoutOptions: { showComments: false } }, s);
        expect(vus.panneau).toBe(true);
    });
});

describe("miseEnPageProjet — cases de l'image du carrefour", () => {
    it('les enregistre avec le projet et les restitue', () => {
        const paquet = lireMiseEnPage(etatCourant);
        expect(paquet.layoutOptions).toMatchObject({
            showImageGroupNumbers: true, showImageGroupNames: false, showImageArrows: false
        });
        const { vus, s } = poseurs();
        appliquerMiseEnPage(paquet, s);
        expect(vus).toMatchObject({ imageNumeros: true, imageNoms: false, imageFleches: false });
    });

    it("laisse la valeur du navigateur pour un projet enregistré avant qu'elles n'en fassent partie", () => {
        const { vus, s } = poseurs();
        appliquerMiseEnPage({ layoutOptions: { showComments: true } }, s);
        expect(vus).not.toHaveProperty('imageNumeros');
        expect(vus).not.toHaveProperty('imageNoms');
        expect(vus).not.toHaveProperty('imageFleches');

        const { vus: vusAncien, s: sAncien } = poseurs();
        appliquerMiseEnPage({ groups: [], pfTabs: [] }, sAncien);
        expect(vusAncien).not.toHaveProperty('imageNoms');
    });
});

describe("affichageCommentairesRemarques — ouverture d'un projet", () => {
    const avecContenu = {
        groups: [{ comment: 'à vérifier' }],
        pfTabs: [{ remarques: 'plan de pointe' }]
    };

    it('reprend le réglage enregistré, même si le projet a du contenu', () => {
        expect(affichageCommentairesRemarques({
            ...avecContenu,
            layoutOptions: { showComments: false, showRemarks: false }
        })).toEqual({ showComments: false, showRemarks: false });
    });

    it('reprend le réglage enregistré, même sans contenu', () => {
        expect(affichageCommentairesRemarques({
            groups: [], pfTabs: [],
            layoutOptions: { showComments: true, showRemarks: true }
        })).toEqual({ showComments: true, showRemarks: true });
    });

    it('sans réglage enregistré, affiche ce qui a du contenu', () => {
        expect(affichageCommentairesRemarques(avecContenu))
            .toEqual({ showComments: true, showRemarks: true });
        expect(affichageCommentairesRemarques({ groups: [], pfTabs: [{ remarques: '  ' }] }))
            .toEqual({ showComments: false, showRemarks: false });
    });

    it("trouve les commentaires portés par un plan de feux", () => {
        expect(affichageCommentairesRemarques({
            groups: [], pfTabs: [{ diagram: [{ comment: 'G2' }] }]
        }).showComments).toBe(true);
    });

    it('traite chaque case séparément', () => {
        expect(affichageCommentairesRemarques({
            ...avecContenu,
            layoutOptions: { showComments: false }
        })).toEqual({ showComments: false, showRemarks: true });
    });
});
