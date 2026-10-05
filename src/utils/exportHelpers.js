/**
 * Helpers for exporting DOM elements as PNG or PDF.
 * Uses html2canvas + jsPDF — this module is intentionally loaded on-demand
 * (via dynamic import) so these heavy libs stay out of the initial bundle.
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export { buildExportFilename } from './exportFilename';

const measuredSize = (element, axis) => {
    if (!element) return 0;
    const rect = element.getBoundingClientRect?.();
    const rectSize = axis === 'width' ? rect?.width : rect?.height;
    const scrollSize = axis === 'width' ? element.scrollWidth : element.scrollHeight;
    const offsetSize = axis === 'width' ? element.offsetWidth : element.offsetHeight;
    return Math.max(Number(rectSize) || 0, Number(scrollSize) || 0, Number(offsetSize) || 0);
};

/**
 * Calcule la surface complète du diagramme, y compris la partie de la piste
 * située hors du viewport courant.
 */
export const getTimelineCaptureDimensions = (element) => {
    if (!element) return { width: 0, height: 0 };
    const sidebar = element.querySelector('.timeline-sidebar');
    const scrollArea = element.querySelector('.timeline-scroll-area');
    const track = element.querySelector('.timeline-track-container');
    const width = Math.ceil(
        measuredSize(sidebar, 'width')
        + Math.max(measuredSize(scrollArea, 'width'), measuredSize(track, 'width'))
    );
    const height = Math.ceil(measuredSize(element, 'height'));
    return { width, height };
};

const controlText = (control) => {
    if (control instanceof HTMLSelectElement) {
        return control.selectedOptions[0]?.textContent || '';
    }
    if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) {
        return control.checked ? '✓' : '';
    }
    return control.value || '';
};

/**
 * Remplace, dans le DOM cloné par html2canvas, les champs éditables par du
 * texte statique. Les valeurs React courantes ne sont pas toujours recopiées
 * dans les attributs HTML du clone.
 */
export const materializeFormControlValues = (sourceRoot, clonedRoot) => {
    if (!sourceRoot || !clonedRoot) return;
    const sourceControls = sourceRoot.querySelectorAll('input, select, textarea');
    const clonedControls = clonedRoot.querySelectorAll('input, select, textarea');

    sourceControls.forEach((sourceControl, index) => {
        const clonedControl = clonedControls[index];
        if (!clonedControl) return;

        const value = controlText(sourceControl);
        const replacement = clonedControl.ownerDocument.createElement('span');
        replacement.className = `${clonedControl.className || ''} png-export-control-value`.trim();
        replacement.textContent = value || '\u00a0';
        replacement.setAttribute('data-export-value', value);

        if (clonedControl.classList.contains('input-micro')) {
            const backdrop = clonedControl.closest('.micro-highlight-container')
                ?.querySelector('.micro-highlight-backdrop');
            if (backdrop) backdrop.style.display = 'none';
        }

        clonedControl.replaceWith(replacement);
    });
};

/**
 * Render the given element onto a canvas with high resolution.
 * Extra options are passed through to html2canvas (e.g. onclone for DOM
 * tweaks on the cloned document used for rendering).
 */
const renderToCanvas = async (element, extraOptions = {}) => {
    return html2canvas(element, {
        backgroundColor: '#1e1e1e',
        scale: 2,              // retina quality
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        ...extraOptions
    });
};

/**
 * Export a DOM element as a PNG file (downloaded) AND copy it to the clipboard.
 *
 * @param {Element} element - DOM element to capture
 * @param {string} filename - filename without extension
 * @param {Object} [options] - extra html2canvas options (e.g. onclone)
 * @returns {Promise<{clipboardSuccess: boolean}>} indicates if the clipboard
 *   copy succeeded ; the file download is always attempted.
 */
export const exportElementAsPNG = async (element, filename, options = {}) => {
    if (!element) throw new Error('Élément introuvable');
    const canvas = await renderToCanvas(element, options);

    // toBlob is callback-based; promisify for sequential await
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Génération du PNG échouée');

    // 1. Download to disk
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 2. Copy to clipboard (best-effort — silently fails on browsers without
    // ClipboardItem support, on HTTP contexts, or if user denies permission).
    let clipboardSuccess = false;
    try {
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            clipboardSuccess = true;
        }
    } catch (e) {
        console.warn('Copie dans le presse-papiers échouée :', e);
    }

    return { clipboardSuccess };
};

/**
 * Export a DOM element as a PDF file (downloaded).
 * Automatically chooses orientation (landscape if wider than tall).
 * Splits into multiple A4 pages vertically if content is taller.
 */
export const exportElementAsPDF = async (element, filename, options = {}) => {
    if (!element) throw new Error('Élément introuvable');
    const canvas = await renderToCanvas(element);
    const imgData = canvas.toDataURL('image/png');

    // Determine orientation: landscape if canvas is wider than tall
    const orientation = options.orientation || (canvas.width > canvas.height ? 'landscape' : 'portrait');
    const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

    // A4 dimensions
    const pageWidth = orientation === 'landscape' ? 297 : 210;
    const pageHeight = orientation === 'landscape' ? 210 : 297;
    const margin = 8; // mm

    const usableWidth = pageWidth - 2 * margin;
    // Scale so canvas width fits usable width
    const imgWidthMm = usableWidth;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

    if (imgHeightMm <= pageHeight - 2 * margin) {
        // Fits on one page
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidthMm, imgHeightMm);
    } else {
        // Split into multiple pages
        const usableHeight = pageHeight - 2 * margin;
        const pxPerMm = canvas.height / imgHeightMm;
        const slicePx = usableHeight * pxPerMm;
        let yOffset = 0;
        while (yOffset < canvas.height) {
            const sliceHeight = Math.min(slicePx, canvas.height - yOffset);
            // Create a temporary canvas containing just this slice
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceHeight;
            const ctx = sliceCanvas.getContext('2d');
            ctx.fillStyle = '#1e1e1e';
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(canvas, 0, -yOffset);
            const sliceImgData = sliceCanvas.toDataURL('image/png');
            const sliceHeightMm = (sliceHeight * imgWidthMm) / canvas.width;
            if (yOffset > 0) pdf.addPage();
            pdf.addImage(sliceImgData, 'PNG', margin, margin, imgWidthMm, sliceHeightMm);
            yOffset += slicePx;
        }
    }

    pdf.save(`${filename}.pdf`);
};
