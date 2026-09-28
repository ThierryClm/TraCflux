import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    openPicker: vi.fn(),
    savePicker: vi.fn(),
    exampleSession: vi.fn(() => false)
}));

vi.mock('../utils/filePicker', () => ({
    safeShowOpenFilePicker: mocks.openPicker,
    safeShowSaveFilePicker: mocks.savePicker
}));
vi.mock('../utils/exampleMode', () => ({ isExampleSession: mocks.exampleSession }));

import useAuth, { comptesActives, EXAMPLE_VISITOR, LOCAL_USER } from './useAuth';

const hash = value => Array.from(new TextEncoder().encode(value))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');

const user = (password = 'secret', permissions = 'lecture', isAdmin = false, createdAt = 1) => ({
    password: hash(password), permissions, isAdmin, createdAt
});

const mountAuth = async () => {
    const hook = renderHook(() => useAuth());
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    return hook;
};

beforeEach(() => {
    localStorage.clear();
    mocks.openPicker.mockReset();
    mocks.savePicker.mockReset();
    mocks.exampleSession.mockReset().mockReturnValue(false);
    vi.restoreAllMocks();
    vi.stubGlobal('crypto', {
        subtle: {
            digest: vi.fn(async (_algorithm, data) => Uint8Array.from(data).buffer)
        }
    });
    delete window.showOpenFilePicker;
    delete window.showSaveFilePicker;
});

describe('configuration des comptes', () => {
    it('désactive les comptes par défaut et ouvre une session locale', async () => {
        expect(comptesActives()).toBe(false);
        const { result } = await mountAuth();
        expect(result.current.accountsEnabled).toBe(false);
        expect(result.current.currentUser).toEqual(LOCAL_USER);
        expect(result.current.isAuthenticated).toBe(true);
    });

    it('respecte le choix explicite, même si des comptes existent', () => {
        localStorage.setItem('auth_users', JSON.stringify({ admin: user() }));
        localStorage.setItem('auth_enabled', 'false');
        expect(comptesActives()).toBe(false);
        localStorage.setItem('auth_enabled', 'true');
        expect(comptesActives()).toBe(true);
    });

    it('déduit l’activation des anciennes installations avec utilisateurs', () => {
        localStorage.setItem('auth_users', JSON.stringify({ admin: user() }));
        expect(comptesActives()).toBe(true);
        localStorage.setItem('auth_users', '{invalide');
        expect(comptesActives()).toBe(false);
    });

    it('active puis désactive les comptes sans supprimer les utilisateurs', async () => {
        const { result } = await mountAuth();
        act(() => result.current.activerComptes());
        expect(result.current.accountsEnabled).toBe(true);
        expect(result.current.currentUser).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
        act(() => result.current.desactiverComptes());
        expect(result.current.currentUser).toEqual(LOCAL_USER);
        expect(localStorage.getItem('auth_enabled')).toBe('false');
    });
});

describe('restauration et connexion', () => {
    it('restaure une session dont l’utilisateur existe encore', async () => {
        localStorage.setItem('auth_enabled', 'true');
        localStorage.setItem('auth_users', JSON.stringify({ alice: user('secret', 'partiel', false) }));
        localStorage.setItem('auth_session', JSON.stringify({ username: 'alice' }));
        const { result } = await mountAuth();
        expect(result.current.currentUser).toEqual({ username: 'alice', permissions: 'partiel', isAdmin: false });
        expect(result.current.isAuthenticated).toBe(true);
    });

    it('supprime une session orpheline', async () => {
        localStorage.setItem('auth_enabled', 'true');
        localStorage.setItem('auth_users', JSON.stringify({ alice: user() }));
        localStorage.setItem('auth_session', JSON.stringify({ username: 'supprime' }));
        const { result } = await mountAuth();
        expect(result.current.isAuthenticated).toBe(false);
        expect(localStorage.getItem('auth_session')).toBeNull();
    });

    it('ouvre un projet exemple avec un visiteur éphémère', async () => {
        localStorage.setItem('auth_enabled', 'true');
        mocks.exampleSession.mockReturnValue(true);
        const { result } = await mountAuth();
        expect(result.current.currentUser).toEqual(EXAMPLE_VISITOR);
        expect(localStorage.getItem('auth_session')).toBeNull();
    });

    it('refuse un utilisateur inconnu ou un mauvais mot de passe', async () => {
        localStorage.setItem('auth_enabled', 'true');
        localStorage.setItem('auth_users', JSON.stringify({ alice: user() }));
        const { result } = await mountAuth();
        await expect(result.current.login('bob', 'secret')).resolves.toEqual({ success: false, error: 'Utilisateur inconnu' });
        await expect(result.current.login('alice', 'mauvais')).resolves.toEqual({ success: false, error: 'Mot de passe incorrect' });
    });

    it('connecte puis déconnecte un utilisateur valide', async () => {
        localStorage.setItem('auth_enabled', 'true');
        localStorage.setItem('auth_users', JSON.stringify({ alice: user('secret', 'total', true) }));
        const { result } = await mountAuth();
        await act(async () => expect(await result.current.login('alice', 'secret')).toEqual({ success: true }));
        expect(result.current.currentUser.username).toBe('alice');
        expect(JSON.parse(localStorage.getItem('auth_session')).username).toBe('alice');
        act(() => result.current.logout());
        expect(result.current.isAuthenticated).toBe(false);
        expect(localStorage.getItem('auth_session')).toBeNull();
    });
});

describe('gestion des utilisateurs', () => {
    it('valide les champs et empêche les doublons', async () => {
        localStorage.setItem('auth_enabled', 'true');
        const { result } = await mountAuth();
        await expect(result.current.createUser('', '', 'lecture')).resolves.toMatchObject({ success: false });
        await act(async () => { await result.current.createUser('alice', 'secret'); });
        await expect(result.current.createUser('alice', 'autre')).resolves.toEqual({ success: false, error: 'Cet utilisateur existe déjà' });
    });

    it('fait du premier utilisateur un administrateur total et le connecte', async () => {
        localStorage.setItem('auth_enabled', 'true');
        const { result } = await mountAuth();
        let response;
        await act(async () => { response = await result.current.createUser('admin', 'secret', 'lecture'); });
        expect(response).toEqual({ success: true, isFirstUser: true });
        expect(result.current.currentUser).toEqual({ username: 'admin', permissions: 'total', isAdmin: true });
        expect(JSON.parse(localStorage.getItem('auth_users')).admin.password).toBe(hash('secret'));
    });

    it('crée ensuite un utilisateur avec la permission choisie', async () => {
        localStorage.setItem('auth_enabled', 'true');
        localStorage.setItem('auth_users', JSON.stringify({ admin: user('secret', 'total', true) }));
        const { result } = await mountAuth();
        let response;
        await act(async () => { response = await result.current.createUser('bob', 'pwd', 'partiel'); });
        expect(response).toEqual({ success: true, isFirstUser: false });
        expect(result.current.users.bob.permissions).toBe('partiel');
        expect(result.current.getUsersList().find(item => item.username === 'bob')).not.toHaveProperty('password');
    });

    it('met à jour un utilisateur et la session courante', async () => {
        localStorage.setItem('auth_enabled', 'true');
        localStorage.setItem('auth_users', JSON.stringify({ alice: user('secret', 'lecture', true) }));
        localStorage.setItem('auth_session', JSON.stringify({ username: 'alice' }));
        const { result } = await mountAuth();
        act(() => expect(result.current.updateUser('alice', 'total')).toEqual({ success: true }));
        expect(result.current.currentUser.permissions).toBe('total');
        expect(result.current.updateUser('absent', 'lecture')).toMatchObject({ success: false });
    });

    it('protège le compte courant et le dernier administrateur', async () => {
        localStorage.setItem('auth_enabled', 'true');
        localStorage.setItem('auth_users', JSON.stringify({
            admin: user('secret', 'total', true),
            bob: user('pwd', 'lecture', false)
        }));
        localStorage.setItem('auth_session', JSON.stringify({ username: 'bob' }));
        const { result } = await mountAuth();
        expect(result.current.deleteUser('bob')).toMatchObject({ success: false, error: expect.stringMatching(/propre compte/) });
        expect(result.current.deleteUser('admin')).toMatchObject({ success: false, error: expect.stringMatching(/dernier administrateur/) });
        expect(result.current.deleteUser('absent')).toMatchObject({ success: false });
    });

    it('supprime un utilisateur quand un autre administrateur reste', async () => {
        localStorage.setItem('auth_enabled', 'true');
        localStorage.setItem('auth_users', JSON.stringify({
            admin1: user('a', 'total', true),
            admin2: user('b', 'total', true)
        }));
        const { result } = await mountAuth();
        act(() => expect(result.current.deleteUser('admin2')).toEqual({ success: true }));
        expect(result.current.users.admin2).toBeUndefined();
    });

    it('change et réinitialise les mots de passe', async () => {
        localStorage.setItem('auth_enabled', 'true');
        localStorage.setItem('auth_users', JSON.stringify({ alice: user() }));
        const { result } = await mountAuth();
        await expect(result.current.changePassword('absent', 'a', 'b')).resolves.toMatchObject({ success: false });
        await expect(result.current.changePassword('alice', 'mauvais', 'nouveau')).resolves.toMatchObject({ success: false });
        await act(async () => expect(await result.current.changePassword('alice', 'secret', 'nouveau')).toEqual({ success: true }));
        expect(JSON.parse(localStorage.getItem('auth_users')).alice.password).toBe(hash('nouveau'));
        await act(async () => expect(await result.current.resetPassword('alice', 'admin-reset')).toEqual({ success: true }));
        await expect(result.current.resetPassword('absent', 'x')).resolves.toMatchObject({ success: false });
    });

    it('applique les permissions et réserve la gestion aux administrateurs', async () => {
        localStorage.setItem('auth_enabled', 'true');
        localStorage.setItem('auth_users', JSON.stringify({ lecteur: user('secret', 'lecture', false) }));
        localStorage.setItem('auth_session', JSON.stringify({ username: 'lecteur' }));
        const { result } = await mountAuth();
        expect(result.current.hasPermission('canOpen')).toBe(true);
        expect(result.current.hasPermission('canSave')).toBe(false);
        expect(result.current.hasPermission('canManageUsers')).toBe(false);
        act(() => result.current.logout());
        expect(result.current.hasPermission('canOpen')).toBe(false);
    });
});

describe('import et export des comptes', () => {
    it('exporte par téléchargement classique sans File System Access API', async () => {
        localStorage.setItem('auth_users', JSON.stringify({ admin: user() }));
        const { result } = await mountAuth();
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:users') });
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
        await expect(result.current.exportUsersToFile()).resolves.toEqual({ success: true });
        expect(click).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:users');
    });

    it('écrit avec le sélecteur natif et traduit une annulation', async () => {
        window.showSaveFilePicker = vi.fn();
        const writable = { write: vi.fn(), close: vi.fn() };
        mocks.savePicker.mockResolvedValueOnce({ createWritable: vi.fn(async () => writable) });
        const { result } = await mountAuth();
        await expect(result.current.exportUsersToFile()).resolves.toEqual({ success: true });
        expect(writable.write).toHaveBeenCalled();
        expect(writable.close).toHaveBeenCalled();
        mocks.savePicker.mockRejectedValueOnce(new DOMException('Annulé', 'AbortError'));
        await expect(result.current.exportUsersToFile()).resolves.toEqual({ success: false, error: 'Annulé' });
    });

    it('refuse l’import sans API, les structures invalides et l’absence d’admin', async () => {
        const { result } = await mountAuth();
        await expect(result.current.importUsersFromFile()).resolves.toMatchObject({ success: false, error: expect.stringMatching(/non supportée/) });

        window.showOpenFilePicker = vi.fn();
        const provide = data => mocks.openPicker.mockResolvedValueOnce([{ getFile: async () => ({ text: async () => JSON.stringify(data) }) }]);
        provide({ alice: { permissions: 'lecture' } });
        await expect(result.current.importUsersFromFile()).resolves.toMatchObject({ success: false, error: expect.stringMatching(/Données invalides/) });
        provide({ alice: user('x', 'inconnue', true) });
        await expect(result.current.importUsersFromFile()).resolves.toMatchObject({ success: false, error: expect.stringMatching(/Permission invalide/) });
        provide({ alice: user('x', 'lecture', false) });
        await expect(result.current.importUsersFromFile()).resolves.toMatchObject({ success: false, error: expect.stringMatching(/administrateur/) });
    });

    it('importe des comptes valides et déconnecte un utilisateur supprimé', async () => {
        localStorage.setItem('auth_enabled', 'true');
        localStorage.setItem('auth_users', JSON.stringify({ ancien: user('x', 'lecture', false) }));
        localStorage.setItem('auth_session', JSON.stringify({ username: 'ancien' }));
        window.showOpenFilePicker = vi.fn();
        mocks.openPicker.mockResolvedValue([{ getFile: async () => ({
            text: async () => JSON.stringify({ admin: user('secret', 'total', true) })
        }) }]);
        const { result } = await mountAuth();
        let response;
        await act(async () => { response = await result.current.importUsersFromFile(); });
        expect(response).toEqual({ success: true, count: 1 });
        expect(result.current.currentUser).toBeNull();
        expect(result.current.users.admin).toBeDefined();
    });
});
