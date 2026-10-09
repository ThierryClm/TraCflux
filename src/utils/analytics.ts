const PRODUCTION_HOSTNAME = 'tracflux.com';
const ANALYTICS_SCRIPT_ID = 'cloudflare-web-analytics';
const ANALYTICS_SCRIPT_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

/** Signaux de confidentialité et environnement observés par la décision. */
export interface AnalyticsContext {
    hostname?: string;
    token?: unknown;
    doNotTrack?: string | null;
    globalPrivacyControl?: boolean;
}

/**
 * Propriétés de confidentialité non standard ou anciennes, absentes des types
 * DOM de TypeScript mais encore exposées par certains navigateurs.
 */
type PrivacyNavigator = Partial<Navigator> & {
    msDoNotTrack?: string | null;
    globalPrivacyControl?: boolean;
};

type AnalyticsWindow = Pick<Window, 'location'> & {
    navigator?: PrivacyNavigator;
    doNotTrack?: string | null;
};

export interface AnalyticsInitOptions {
    windowRef?: AnalyticsWindow;
    documentRef?: Pick<Document, 'getElementById' | 'createElement' | 'head'>;
    token?: string;
}

/**
 * Décide si la mesure d'audience peut être chargée.
 *
 * Elle reste strictement limitée au domaine public. Les previews Surge,
 * localhost, GitHub Pages et les fenêtres ouvertes depuis un fichier local ne
 * produisent donc aucune donnée. Les signaux de confidentialité du navigateur
 * sont prioritaires sur la mesure d'audience.
 */
export function shouldLoadAnalytics({ hostname, token, doNotTrack, globalPrivacyControl }: AnalyticsContext): boolean {
    const privacySignalEnabled = globalPrivacyControl === true
        || doNotTrack === '1'
        || doNotTrack === 'yes';

    return hostname === PRODUCTION_HOSTNAME
        && typeof token === 'string'
        && token.trim().length > 0
        && !privacySignalEnabled;
}

/**
 * Charge Cloudflare Web Analytics une seule fois, sans cookie ni événement
 * métier. Le script ne reçoit que son identifiant public de site : aucune
 * donnée de projet TraCflux ne lui est transmise.
 */
export function initPrivacyFriendlyAnalytics({
    windowRef = window as AnalyticsWindow,
    documentRef = document,
    token = import.meta.env.VITE_CLOUDFLARE_ANALYTICS_TOKEN,
}: AnalyticsInitOptions = {}): boolean {
    const navigatorRef: PrivacyNavigator = windowRef.navigator ?? {};
    const doNotTrack = navigatorRef.doNotTrack
        ?? windowRef.doNotTrack
        ?? navigatorRef.msDoNotTrack;

    if (!shouldLoadAnalytics({
        hostname: windowRef.location?.hostname,
        token,
        doNotTrack,
        globalPrivacyControl: navigatorRef.globalPrivacyControl,
    })) {
        return false;
    }

    if (documentRef.getElementById(ANALYTICS_SCRIPT_ID)) {
        return true;
    }

    const script = documentRef.createElement('script');
    script.id = ANALYTICS_SCRIPT_ID;
    script.defer = true;
    script.src = ANALYTICS_SCRIPT_SRC;
    script.dataset.cfBeacon = JSON.stringify({ token: (token as string).trim() });
    documentRef.head.appendChild(script);

    return true;
}

export { ANALYTICS_SCRIPT_ID, ANALYTICS_SCRIPT_SRC, PRODUCTION_HOSTNAME };
