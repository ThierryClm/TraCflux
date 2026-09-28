import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    html2canvas: vi.fn(),
    jsPDF: vi.fn()
}));

vi.mock('html2canvas', () => ({ default: mocks.html2canvas }));
vi.mock('jspdf', () => ({ jsPDF: mocks.jsPDF }));

import { exportElementAsPDF, exportElementAsPNG } from './exportHelpers';

const element = () => {
    const node = document.createElement('div');
    Object.defineProperties(node, {
        scrollWidth: { value: 640 },
        scrollHeight: { value: 480 }
    });
    return node;
};

beforeEach(() => {
    vi.restoreAllMocks();
    mocks.html2canvas.mockReset();
    mocks.jsPDF.mockReset();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});

describe('exportElementAsPNG', () => {
    it('refuse un élément absent', async () => {
        await expect(exportElementAsPNG(null, 'test')).rejects.toThrow('Élément introuvable');
        expect(mocks.html2canvas).not.toHaveBeenCalled();
    });

    it('capture en haute résolution, télécharge et copie le PNG', async () => {
        const blob = new Blob(['png'], { type: 'image/png' });
        const canvas = { toBlob: vi.fn(callback => callback(blob)) };
        mocks.html2canvas.mockResolvedValue(canvas);
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        const write = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
        vi.stubGlobal('ClipboardItem', class ClipboardItem {
            constructor(data) { this.data = data; }
        });
        const node = element();

        await expect(exportElementAsPNG(node, 'diagramme', { foreignObjectRendering: true }))
            .resolves.toEqual({ clipboardSuccess: true });

        expect(mocks.html2canvas).toHaveBeenCalledWith(node, expect.objectContaining({
            backgroundColor: '#1e1e1e', scale: 2, useCORS: true,
            windowWidth: 640, windowHeight: 480, foreignObjectRendering: true
        }));
        expect(click).toHaveBeenCalledTimes(1);
        expect(write).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
        expect(document.querySelector('a[download="diagramme.png"]')).toBeNull();
        vi.unstubAllGlobals();
    });

    it('échoue clairement si le navigateur ne produit pas de blob', async () => {
        mocks.html2canvas.mockResolvedValue({ toBlob: callback => callback(null) });
        await expect(exportElementAsPNG(element(), 'diagramme')).rejects.toThrow('Génération du PNG échouée');
    });

    it('termine le téléchargement si le presse-papiers refuse', async () => {
        const blob = new Blob(['png'], { type: 'image/png' });
        mocks.html2canvas.mockResolvedValue({ toBlob: callback => callback(blob) });
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { write: vi.fn().mockRejectedValue(new Error('interdit')) }
        });
        vi.stubGlobal('ClipboardItem', class ClipboardItem {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(exportElementAsPNG(element(), 'diagramme')).resolves.toEqual({ clipboardSuccess: false });
        expect(console.warn).toHaveBeenCalled();
        vi.unstubAllGlobals();
    });
});

describe('exportElementAsPDF', () => {
    it('choisit le paysage et produit une page quand le contenu tient', async () => {
        const canvas = { width: 1000, height: 500, toDataURL: vi.fn(() => 'data:image/png;base64,x') };
        mocks.html2canvas.mockResolvedValue(canvas);
        const pdf = { addImage: vi.fn(), addPage: vi.fn(), save: vi.fn() };
        mocks.jsPDF.mockImplementation(class {
            constructor() { Object.assign(this, pdf); }
        });

        await exportElementAsPDF(element(), 'rapport');

        expect(mocks.jsPDF).toHaveBeenCalledWith({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        expect(pdf.addImage).toHaveBeenCalledTimes(1);
        expect(pdf.addPage).not.toHaveBeenCalled();
        expect(pdf.save).toHaveBeenCalledWith('rapport.pdf');
    });

    it('respecte une orientation imposée', async () => {
        const canvas = { width: 1000, height: 500, toDataURL: vi.fn(() => 'image') };
        mocks.html2canvas.mockResolvedValue(canvas);
        const pdf = { addImage: vi.fn(), addPage: vi.fn(), save: vi.fn() };
        mocks.jsPDF.mockImplementation(class {
            constructor() { Object.assign(this, pdf); }
        });
        await exportElementAsPDF(element(), 'portrait', { orientation: 'portrait' });
        expect(mocks.jsPDF).toHaveBeenCalledWith({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    });
});
