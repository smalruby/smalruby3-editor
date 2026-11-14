/* eslint-env jest */
import { withReply, withVariable, emptySettings } from '../../../../src/lib/mesh-practice/partner';
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

describe('mesh practice partner: browser storage (#1845)', () => {
    test('the key uses the smalruby: prefix', () => {
        expect(STORAGE_KEY).toBe('smalruby:meshPracticePartner');
    });

    test('the project key is the project id, else the title, else none', () => {
        expect(projectKeyOf({ projectId: '123', projectTitle: 't' })).toBe('id:123');
        expect(projectKeyOf({ projectId: '0', projectTitle: ' My game ' })).toBe('title:My game');
        expect(projectKeyOf({ projectId: null, projectTitle: '' })).toBeNull();
        expect(projectKeyOf()).toBeNull();
    });

    test('settings are kept per project, and the last settings are used for a project without its own', () => {
        const storage = memoryStorage();
        const a = withVariable(emptySettings(), 'x', '1');
        const b = withReply(emptySettings(), { onBroadcast: 'p', broadcast: 'q', value: '' });
        expect(savePartnerSettings('title:A', a, storage)).toBe(true);
        expect(savePartnerSettings('title:B', b, storage)).toBe(true);
        expect(loadPartnerSettings('title:A', storage)).toEqual(a);
        expect(loadPartnerSettings('title:B', storage)).toEqual(b);
        // unknown project or no key: the last settings
        expect(loadPartnerSettings('title:C', storage)).toEqual(b);
        expect(loadPartnerSettings(null, storage)).toEqual(b);
    });

    test('only the last MAX_PROJECTS projects are kept', () => {
        const storage = memoryStorage();
        for (let i = 0; i < MAX_PROJECTS + 5; i++) {
            savePartnerSettings(`title:${i}`, withVariable(emptySettings(), `v${i}`, ''), storage);
        }
        const all = JSON.parse(storage.data[STORAGE_KEY]);
        expect(Object.keys(all.projects)).toHaveLength(MAX_PROJECTS);
        expect(all.projects['title:0']).toBeUndefined();
    });

    test('broken or missing storage does not throw', () => {
        const storage = memoryStorage();
        storage.data[STORAGE_KEY] = '{not json';
        expect(loadPartnerSettings('title:A', storage)).toEqual(emptySettings());
        expect(loadPartnerSettings('title:A', null)).toEqual(emptySettings());
        expect(savePartnerSettings('title:A', emptySettings(), null)).toBe(false);
        const full = {
            getItem: () => null,
            setItem: () => {
                throw new Error('QuotaExceeded');
            },
        };
        expect(savePartnerSettings('title:A', emptySettings(), full)).toBe(false);
    });
});
