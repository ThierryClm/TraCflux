import { describe, it, expect } from 'vitest';
import { chercherDansAide, indexerAide, normaliser, positionsOccurrences, preparerRequete, regrouperParRubrique } from './rechercheAide';

describe('normalisation du texte cherché', () => {
    it('ignore la casse, les accents et les apostrophes typographiques', () => {
        expect(normaliser('Écran À L’Arrêt').texte).toBe("ecran a l'arret");
    });

    it('développe œ et æ, et garde la position d’origine de chaque caractère', () => {
        const { texte, origine } = normaliser('cœur');
        expect(texte).toBe('coeur');
        expect(origine).toEqual([0, 1, 1, 2, 3]);
    });

    it('réduit les espaces multiples à un seul', () => {
        expect(normaliser('a  \n b').texte).toBe('a b');
    });

    it('une requête de moins de deux caractères ne cherche rien', () => {
        expect(preparerRequete(' é ')).toBe('');
        expect(preparerRequete('  Vert ')).toBe('vert');
    });

    it('occurrences sans chevauchement', () => {
        expect(positionsOccurrences('aaaa', 'aa')).toEqual([0, 2]);
        expect(positionsOccurrences('abc', '')).toEqual([]);
    });
});

const aide = () => {
    document.body.innerHTML = `
        <div id="aide">
            <div class="help-recherche"><input value="écran"></div>
            <nav id="help-sommaire"><a>Écran</a></nav>
            <h3 id="ch1">Chapitre 1</h3>
            <h4 id="s1">Présentation</h4>
            <p>Un <strong>écr</strong>an large.</p>
            <h4 id="s2">Mise en page</h4>
            <p>Petit ECRAN, grand écran.</p>
            <h3 id="ch2">Chapitre 2 — Onde verte</h3>
            <p>Vert sur l’écran.</p>
            <button>écran</button>
        </div>`;
    return document.getElementById('aide');
};

describe('recherche dans le texte de l’aide', () => {
    it('trouve les occurrences, hors sommaire, barre de recherche et boutons', () => {
        const index = indexerAide(aide(), '#help-sommaire, .help-recherche, button');
        const occ = chercherDansAide(index, 'Ecran');
        expect(occ).toHaveLength(4);
        expect(occ.map(o => o.section?.id ?? null)).toEqual(['s1', 's2', 's2', null]);
        expect(occ.map(o => o.chapitre.id)).toEqual(['ch1', 'ch1', 'ch1', 'ch2']);
    });

    it('une occurrence à cheval sur deux nœuds texte donne une plage qui les couvre', () => {
        const index = indexerAide(aide(), '#help-sommaire, .help-recherche, button');
        const [premiere] = chercherDansAide(index, 'écran');
        const r = document.createRange();
        r.setStart(premiere.debut.noeud, premiere.debut.offset);
        r.setEnd(premiere.fin.noeud, premiere.fin.offset);
        expect(r.toString()).toBe('écran');
        expect(premiere.debut.noeud).not.toBe(premiere.fin.noeud);
    });

    it('la plage garde le texte exact, accents et majuscules compris', () => {
        const index = indexerAide(aide(), '#help-sommaire, .help-recherche, button');
        const textes = chercherDansAide(index, 'ecran').map(o => {
            const r = document.createRange();
            r.setStart(o.debut.noeud, o.debut.offset);
            r.setEnd(o.fin.noeud, o.fin.offset);
            return r.toString();
        });
        expect(textes).toEqual(['écran', 'ECRAN', 'écran', 'écran']);
    });

    it('regroupe par section, dans l’ordre de l’aide, avec la première occurrence de chacune', () => {
        const index = indexerAide(aide(), '#help-sommaire, .help-recherche, button');
        const groupes = regrouperParRubrique(chercherDansAide(index, 'écran'));
        expect(groupes.map(g => [g.chapitre.id, g.rubrique.id, g.nombre, g.premiere])).toEqual([
            ['ch1', 's1', 1, 0],
            ['ch1', 's2', 2, 1],
            ['ch2', 'ch2', 1, 3],
        ]);
    });
});
