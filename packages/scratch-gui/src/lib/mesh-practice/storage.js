// === Smalruby: This file is Smalruby-specific (mesh practice partner: browser storage) ===
// ひとりで使う練習相手（#1845）の設定を、作品ではなくブラウザ（localStorage）に覚える（EPIC #1842 Q9）。
// 提出した作品に練習の設定が混ざらないようにするため、VM・作品の JSON には何も書かない。
//
// 1 つのキーに、作品ごとの設定と「最後に使った設定」を入れる:
//   smalruby:meshPracticePartner = { version: 1, projects: { [作品のキー]: 設定 }, last: 設定 }
// - 作品のキーは、作品の ID（Google ドライブ・共有など）があればそれ、無ければ作品の名前。
//   どちらも無い（まだ名前の無い新しい作品）ときは「最後に使った設定」だけを使う。
// - 作品ごとの設定が無いときは「最後に使った設定」から始める（同じ作品を名前を変えて保存しなおしたときなど）。
// - 作品の数は MAX_PROJECTS まで（古いものから消す）。
import { sanitizeSettings } from './partner';

export const STORAGE_KEY = 'smalruby:meshPracticePartner';
export const MAX_PROJECTS = 20;

// scratch-gui の既定の作品 ID（reducers/project-state.js の defaultProjectId）
const DEFAULT_PROJECT_ID = '0';

const defaultStorage = () => {
    try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch (error) {
        return null;
    }
};

/**
 * 作品のキー。
 * @param {{projectId: ?(string|number), projectTitle: ?string}} project - 作品の ID と名前。
 * @returns {?string} キー（決められなければ null）。
 */
export const projectKeyOf = ({ projectId, projectTitle } = {}) => {
    const id = projectId === null || typeof projectId === 'undefined' ? '' : String(projectId);
    if (id !== '' && id !== DEFAULT_PROJECT_ID) return `id:${id}`;
    const title = typeof projectTitle === 'string' ? projectTitle.trim() : '';
    return title === '' ? null : `title:${title}`;
};

const readAll = (storage) => {
    if (!storage) return null;
    try {
        const raw = storage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return null;
        return parsed;
    } catch (error) {
        return null;
    }
};

/**
 * 設定を読む。
 * @param {?string} projectKey - 作品のキー（projectKeyOf）。
 * @param {?object} [storage] - localStorage（テスト用）。
 * @returns {object} 設定（無ければ空）。
 */
export const loadPartnerSettings = (projectKey, storage = defaultStorage()) => {
    const all = readAll(storage);
    if (!all) return sanitizeSettings(null);
    const projects = all.projects && typeof all.projects === 'object' ? all.projects : {};
    if (projectKey && Object.prototype.hasOwnProperty.call(projects, projectKey)) {
        return sanitizeSettings(projects[projectKey]);
    }
    return sanitizeSettings(all.last);
};

/**
 * 設定を覚える。書けない（容量・プライベートモード）ときは何もしない（練習は続けられる）。
 * @param {?string} projectKey - 作品のキー。
 * @param {object} settings - 設定。
 * @param {?object} [storage] - localStorage（テスト用）。
 * @returns {boolean} 書けたら true。
 */
export const savePartnerSettings = (projectKey, settings, storage = defaultStorage()) => {
    if (!storage) return false;
    const clean = sanitizeSettings(settings);
    const all = readAll(storage) || { version: 1, projects: {}, last: null };
    const projects = { ...(all.projects || {}) };
    if (projectKey) {
        // 新しく使ったものを最後に置き、古いものから消す
        delete projects[projectKey];
        projects[projectKey] = clean;
        const keys = Object.keys(projects);
        keys.slice(0, Math.max(0, keys.length - MAX_PROJECTS)).forEach((key) => delete projects[key]);
    }
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, projects, last: clean }));
        return true;
    } catch (error) {
        return false;
    }
};
