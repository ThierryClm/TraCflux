import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImpressionDossier, useMiseEnPageImpression } from './useImpressionDossier';

const ouvrir = vi.hoisted(() => vi.fn());
vi.mock('../utils/ongletImpression', async (original) => ({
    ...(await original()),
    ouvrirOngletImpression: ouvrir,
}));

const entrees = { actionColWidths: { description: 160, micro: 420, abrv: 38 }, activeTab: 'diagram', simulationEnabled: false, phasageBulleEnabled: false };

beforeEach(() => { localStorage.clear(); ouvrir.mockClear(); });
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

describe('mise en page du dossier imprimé', () => {
    it('paysage par défaut : zone utile de 277 mm, en px CSS', () => {
        const { result } = renderHook(() => useMiseEnPageImpression(entrees));
        expect(result.current.dossierPortrait).toBe(false);
        expect(result.current.dossierPrintWidth).toBeCloseTo(277 * 96 / 25.4);
    });

    it('le portrait est mémorisé sur le poste et réduit la zone utile à 190 mm', () => {
        const { result } = renderHook(() => useMiseEnPageImpression(entrees));
        act(() => result.current.setDossierPortrait(true));
        expect(localStorage.getItem('dossier_orientation')).toBe('portrait');
        expect(result.current.dossierPrintWidth).toBeCloseTo(190 * 96 / 25.4);
        const relu = renderHook(() => useMiseEnPageImpression(entrees));
        expect(relu.result.current.dossierPortrait).toBe(true);
    });

    it('tableau des conditions absent : largeur reconstruite à partir des colonnes réglables', () => {
        const { result } = renderHook(() => useMiseEnPageImpression({
            ...entrees, actionColWidths: { description: 200, micro: 500, abrv: 40 }
        }));
        expect(result.current.largeurConditionsImpression).toBe(343 + 200 + 500 + 40);
        expect(result.current.microPrintStyle).toBeNull();
    });
});

describe('impression du dossier', () => {
    const preparer = () => {
        const setters = { setDossierDialog: vi.fn(), setPrintType: vi.fn(), setPrintPreviewModal: vi.fn() };
        const { result } = renderHook(() => useImpressionDossier({ dossierPortrait: false, ...setters }));
        return { result, ...setters };
    };

    it("Imprimer : ferme la boîte, ouvre l'aperçu, l'imprime dans un onglet après 500 ms, puis le referme", () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div class="print-preview-overlay"><p>Dossier</p></div>';
        const { result, setDossierDialog, setPrintType, setPrintPreviewModal } = preparer();
        act(() => result.current.handleDossierConfirm());
        expect(setDossierDialog).toHaveBeenCalledWith(false);
        expect(setPrintType).toHaveBeenLastCalledWith('dossier');
        expect(setPrintPreviewModal).toHaveBeenLastCalledWith(true);
        expect(ouvrir).not.toHaveBeenCalled();
        act(() => { vi.advanceTimersByTime(500); });
        expect(ouvrir).toHaveBeenCalledTimes(1);
        const html = ouvrir.mock.calls[0][0];
        expect(html).toContain('Dossier');
        expect(html).toContain('print-dossier');
        expect(setPrintPreviewModal).toHaveBeenLastCalledWith(false);
        expect(setPrintType).toHaveBeenLastCalledWith(null);
        // Le pied de page n'est injecté que le temps de la copie.
        expect(document.getElementById('dossier-print-footer-style')).toBeNull();
    });

    it("le pied de page porte l'outil et sa version", () => {
        document.body.innerHTML = '<div class="print-preview-overlay"></div>';
        const ajout = vi.spyOn(document.head, 'appendChild');
        const { result } = preparer();
        result.current.imprimerApercu('dossier');
        const style = ajout.mock.calls.map(([el]) => el).find(el => el.id === 'dossier-print-footer-style');
        expect(style.textContent).toMatch(/@bottom-left \{ content: "TraCflux \d+\.\d+\.\d+"/);
        expect(style.textContent).toContain('counter(page)');
    });

    it("sans aperçu affiché, rien n'est imprimé", () => {
        const { result } = preparer();
        result.current.imprimerApercu('dossier');
        expect(ouvrir).not.toHaveBeenCalled();
    });
});
