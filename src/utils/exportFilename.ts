/**
 * Pure filename helper — kept separate from exportHelpers.js so consumers can
 * import it without pulling html2canvas/jsPDF into the main bundle.
 */
const sanitize = (s: unknown): string => String(s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-');

/**
 * Build a safe filename base:  {Project}_{PF}_{YYYY-MM-DD}
 */
export const buildExportFilename = (projectName?: string | null, pfName?: string | null): string => {
    const parts: string[] = [];
    if (projectName) parts.push(sanitize(projectName));
    if (pfName) parts.push(sanitize(pfName));
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    parts.push(date);
    return parts.join('_') || 'export';
};
