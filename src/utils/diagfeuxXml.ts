/** Lecture des données XML DiagFeux, sans parcourir le schéma .NET embarqué. */
type Parent = Element | null | undefined;
const normalise = (s: string): string => s.normalize('NFC');
export const kids = (parent: Parent, name: string): Element[] => parent
    ? Array.from(parent.children).filter(c => normalise(c.localName) === name && c.namespaceURI !== 'http://www.w3.org/2001/XMLSchema')
    : [];
export const kid = (parent: Parent, name: string): Element | null => kids(parent, name)[0] ?? null;
export const txt = (parent: Parent, name: string): string => (kid(parent, name)?.textContent ?? '').trim().normalize('NFC');
export const attr = (parent: Parent, name: string): string => {
    const a = Array.from(parent?.attributes ?? []).find(a => normalise(a.localName) === name);
    return (a?.value ?? '').trim().normalize('NFC');
};
export const value = (el: Parent): number => {
    const s = (el?.textContent ?? '').trim();
    return s === '' ? NaN : Number(s);
};
export const numOf = (parent: Parent, name: string, fallback = 0): number => {
    const v = value(kid(parent, name));
    return Number.isFinite(v) ? v : fallback;
};
export const boolOf = (parent: Parent, name: string): boolean => /^(true|1)$/i.test(txt(parent, name));
