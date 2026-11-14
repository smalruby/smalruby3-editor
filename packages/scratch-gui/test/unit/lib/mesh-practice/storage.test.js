/* eslint-env jest */
import { emptySettings, withReply, withVariable } from '../../../../src/lib/mesh-practice/partner';
import {
    loadPartnerSettings,
    MAX_PROJECTS,
    projectKeyOf,
    savePartnerSettings,
    STORAGE_KEY,
} from '../../../../src/lib/mesh-practice/storage';

const memoryStorage = () => {
    const data = {};
    return {
        data,
        getItem: (key) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null),
        setItem: (key, value) => {
            data[key] = String(value);
        },
    };
};
const memoryStores = () => ({ local: memoryStorage(), session: memoryStorage() });

describe('mesh practice partner: browser storage (#1845)', () => {
    test('the key uses the smalruby: prefix', () => {
        expect(STORAGE_KEY).toBe('smalruby:meshPracticePartner');
    });

    test('the project key is the project id only (never the title)', () => {
        expect(projectKeyOf({ projectId: '123', projectTitle: 't' })).toBe('id:123');
        expect(projectKeyOf({ projectId: '0', projectTitle: 'My game' })).toBeNull();
        expect(projectKeyOf({ projectId: null })).toBeNull();
        expect(projectKeyOf()).toBeNull();
    });

    test('projects with an id are kept per id in localStorage', () => {
        const stores = memoryStores();
        const a = withVariable(emptySettings(), 'x', '1');
        const b = withReply(emptySettings(), { onBroadcast: 'p', broadcast: 'q', value: '' });
        expect(savePartnerSettings('id:A', a, stores)).toBe(true);
        expect(savePartnerSettings('id:B', b, stores)).toBe(true);
        expect(loadPartnerSettings('id:A', stores)).toEqual(a);
        expect(loadPartnerSettings('id:B', stores)).toEqual(b);
        expect(loadPartnerSettings('id:C', stores)).toBeNull();
        expect(stores.session.data[STORAGE_KEY]).toBeUndefined();
    });

    test('projects without an id are kept for this tab only (sessionStorage)', () => {
        const stores = memoryStores();
        const a = withVariable(emptySettings(), 'x', '1');
        expect(loadPartnerSettings(null, stores)).toBeNull();
        expect(savePartnerSettings(null, a, stores)).toBe(true);
        expect(loadPartnerSettings(null, stores)).toEqual(a);
        expect(stores.local.data[STORAGE_KEY]).toBeUndefined();
    });

    test('only the last MAX_PROJECTS projects are kept', () => {
        const stores = memoryStores();
        for (let i = 0; i < MAX_PROJECTS + 5; i++) {
            savePartnerSettings(`id:${i}`, withVariable(emptySettings(), `v${i}`, ''), stores);
        }
        const all = JSON.parse(stores.local.data[STORAGE_KEY]);
        expect(Object.keys(all.projects)).toHaveLength(MAX_PROJECTS);
        expect(all.projects['id:0']).toBeUndefined();
    });

    test('broken or missing storage does not throw', () => {
        const stores = memoryStores();
        stores.local.data[STORAGE_KEY] = '{not json';
        expect(loadPartnerSettings('id:A', stores)).toBeNull();
        expect(loadPartnerSettings('id:A', { local: null, session: null })).toBeNull();
        expect(savePartnerSettings('id:A', emptySettings(), { local: null, session: null })).toBe(false);
        const full = {
            getItem: () => null,
            setItem: () => {
                throw new Error('QuotaExceeded');
            },
        };
        expect(savePartnerSettings('id:A', emptySettings(), { local: full, session: full })).toBe(false);
    });
});
