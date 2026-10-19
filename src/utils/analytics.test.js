import { afterEach, describe, expect, it } from 'vitest';
import {
    ANALYTICS_SCRIPT_ID,
    ANALYTICS_SCRIPT_SRC,
    initPrivacyFriendlyAnalytics,
    shouldLoadAnalytics,
} from './analytics';

afterEach(() => {
    document.getElementById(ANALYTICS_SCRIPT_ID)?.remove();
});

describe('shouldLoadAnalytics', () => {
    it('autorise uniquement le domaine public avec un identifiant configuré', () => {
        expect(shouldLoadAnalytics({
            hostname: 'tracflux.com',
            token: 'site-token',
        })).toBe(true);

        expect(shouldLoadAnalytics({ hostname: 'localhost', token: 'site-token' })).toBe(false);
        expect(shouldLoadAnalytics({ hostname: 'tracflux-feature.surge.sh', token: 'site-token' })).toBe(false);
        expect(shouldLoadAnalytics({ hostname: 'tracflux.com', token: '' })).toBe(false);
    });

    it('respecte Do Not Track et Global Privacy Control', () => {
        const base = { hostname: 'tracflux.com', token: 'site-token' };

        expect(shouldLoadAnalytics({ ...base, doNotTrack: '1' })).toBe(false);
        expect(shouldLoadAnalytics({ ...base, doNotTrack: 'yes' })).toBe(false);
        expect(shouldLoadAnalytics({ ...base, globalPrivacyControl: true })).toBe(false);
    });
});

describe('initPrivacyFriendlyAnalytics', () => {
    const buildWindow = ({ hostname = 'tracflux.com', doNotTrack, globalPrivacyControl } = {}) => ({
        location: { hostname },
        navigator: { doNotTrack, globalPrivacyControl },
    });

    it('injecte le beacon Cloudflare sans donnée métier', () => {
        const loaded = initPrivacyFriendlyAnalytics({
            windowRef: buildWindow(),
            documentRef: document,
            token: 'site-token',
        });

        const script = document.getElementById(ANALYTICS_SCRIPT_ID);
        expect(loaded).toBe(true);
        expect(script).toHaveAttribute('src', ANALYTICS_SCRIPT_SRC);
        expect(script).toHaveAttribute('data-cf-beacon', JSON.stringify({ token: 'site-token' }));
        expect(script).toHaveAttribute('defer');
        expect(script.outerHTML).not.toMatch(/projet|carrefour|groupe/i);
    });

    it('ne charge rien sur une preview ou avec un signal de confidentialité', () => {
        expect(initPrivacyFriendlyAnalytics({
            windowRef: buildWindow({ hostname: 'tracflux-test.surge.sh' }),
            documentRef: document,
            token: 'site-token',
        })).toBe(false);

        expect(initPrivacyFriendlyAnalytics({
            windowRef: buildWindow({ globalPrivacyControl: true }),
            documentRef: document,
            token: 'site-token',
        })).toBe(false);

        expect(document.getElementById(ANALYTICS_SCRIPT_ID)).toBeNull();
    });

    it('n’injecte jamais le script deux fois', () => {
        const options = {
            windowRef: buildWindow(),
            documentRef: document,
            token: 'site-token',
        };

        initPrivacyFriendlyAnalytics(options);
        initPrivacyFriendlyAnalytics(options);

        expect(document.querySelectorAll(`#${ANALYTICS_SCRIPT_ID}`)).toHaveLength(1);
    });
});
