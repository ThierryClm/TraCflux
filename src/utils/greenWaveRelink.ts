/**
 * Rattachement d'un carrefour de l'onde verte à un autre dossier.
 *
 * Chaque carrefour est relié à son dossier par le nom (`projectName`, clé
 * `traffic_project_<nom>` du cache). Un dossier renommé, ou remplacé par une
 * nouvelle version, rompait ce lien : synchronisation et changement de plan
 * de feux ne le retrouvaient plus. Le rattachement recharge groupes, plans de
 * feux, cycle et actions depuis le nouveau dossier, en conservant la place du
 * carrefour, ses distances et, si possible, son plan de feux et ses groupes.
 */

interface GroupLike {
    id: number;
    name?: string;
    offset?: number;
    durations?: { green?: number; [key: string]: unknown };
    [key: string]: unknown;
}

interface PfLike {
    id: number;
    name?: string;
    cycleLength?: number;
    data?: unknown[];
    diagram?: Array<{ groupId: number; offset?: number; greenDuration?: number }>;
    [key: string]: unknown;
}

export interface GreenWaveIntersection {
    /** Nom du fichier du dossier, qui sert aussi de clé dans le cache. */
    projectName: string;
    /** Titre du projet (champ « nom du carrefour » du dossier). */
    intersectionName?: string;
    groups: GroupLike[];
    pfTabs?: PfLike[];
    selectedPfId?: number;
    selectedGroup1?: number;
    selectedGroup2?: number;
    cycleLength?: number;
    actionData?: unknown[];
    [key: string]: unknown;
}

export interface ProjectLike {
    intersectionName?: string;
    groups?: GroupLike[];
    pfTabs?: PfLike[];
    cycleLength?: number;
    actionData?: unknown[];
    [key: string]: unknown;
}

/** same : même numéro et même nom ; byName : retrouvé par son nom ;
 *  byId : même numéro mais nom différent ; missing : remplacé par défaut. */
export type GroupMatch = 'same' | 'byName' | 'byId' | 'missing';

export interface GroupReport {
    before: string;
    after: string;
    match: GroupMatch;
}

export interface RelinkReport {
    projectBefore: string;
    projectAfter: string;
    pfBefore: string;
    pfAfter: string;
    pfKept: boolean;
    cycleBefore: number | undefined;
    cycleAfter: number | undefined;
    descending: GroupReport;
    ascending: GroupReport;
}

/** Titre affiché pour un carrefour : titre du projet, à défaut le nom du fichier. */
export const intersectionTitle = (intersection: Pick<GreenWaveIntersection, 'projectName' | 'intersectionName'>, cachedTitle?: string | null): string =>
    intersection.intersectionName || cachedTitle || intersection.projectName;

const groupLabel = (group: GroupLike | undefined): string =>
    group ? `G${group.id} - ${group.name || 'Sans nom'}` : '—';

/** Applique au groupe les décalages et durées de vert propres au plan de feux. */
export const applyPfDiagram = (groups: GroupLike[], pf: PfLike | undefined): GroupLike[] => {
    if (!pf?.diagram || !Array.isArray(pf.diagram)) return groups;
    const diagram = pf.diagram;
    return groups.map(group => {
        const entry = diagram.find(d => d.groupId === group.id);
        if (!entry) return group;
        return {
            ...group,
            offset: entry.offset ?? group.offset,
            durations: {
                ...group.durations,
                green: entry.greenDuration ?? group.durations?.green
            }
        };
    });
};

const matchGroup = (previous: GroupLike | undefined, groups: GroupLike[]): { group: GroupLike | undefined; match: GroupMatch } => {
    if (previous) {
        const sameId = groups.find(g => g.id === previous.id);
        if (sameId && (sameId.name || '') === (previous.name || '')) return { group: sameId, match: 'same' };
        const sameName = previous.name ? groups.find(g => g.name === previous.name) : undefined;
        if (sameName) return { group: sameName, match: 'byName' };
        if (sameId) return { group: sameId, match: 'byId' };
    }
    return { group: groups[0], match: 'missing' };
};

export const relinkIntersection = (
    intersection: GreenWaveIntersection,
    projectName: string,
    project: ProjectLike
): { intersection: GreenWaveIntersection; report: RelinkReport } => {
    const pfTabs: PfLike[] = Array.isArray(project.pfTabs) && project.pfTabs.length > 0
        ? project.pfTabs
        : [{ id: 1, name: 'PF1', data: project.actionData || [] }];

    const previousPf = intersection.pfTabs?.find(pf => pf.id === intersection.selectedPfId);
    const pfByName = previousPf?.name ? pfTabs.find(pf => pf.name === previousPf.name) : undefined;
    const pf = pfByName || pfTabs[0];

    const groups = applyPfDiagram(Array.isArray(project.groups) ? project.groups : [], pf);
    const previousDesc = intersection.groups?.find(g => g.id === intersection.selectedGroup1);
    const previousAsc = intersection.groups?.find(g => g.id === intersection.selectedGroup2);
    const desc = matchGroup(previousDesc, groups);
    const asc = matchGroup(previousAsc, groups);

    const cycleLength = pf?.cycleLength || project.cycleLength || intersection.cycleLength;

    return {
        intersection: {
            ...intersection,
            projectName,
            intersectionName: project.intersectionName || undefined,
            groups,
            pfTabs,
            selectedPfId: pf?.id,
            selectedGroup1: desc.group?.id ?? intersection.selectedGroup1,
            selectedGroup2: asc.group?.id ?? intersection.selectedGroup2,
            cycleLength,
            actionData: pf?.data || []
        },
        report: {
            projectBefore: intersection.projectName,
            projectAfter: projectName,
            pfBefore: previousPf?.name || '—',
            pfAfter: pf?.name || '—',
            pfKept: !!pfByName,
            cycleBefore: intersection.cycleLength,
            cycleAfter: cycleLength,
            descending: { before: groupLabel(previousDesc), after: groupLabel(desc.group), match: desc.match },
            ascending: { before: groupLabel(previousAsc), after: groupLabel(asc.group), match: asc.match }
        }
    };
};
