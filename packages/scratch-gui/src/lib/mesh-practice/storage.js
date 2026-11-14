// === Smalruby: This file is Smalruby-specific (mesh practice partner: browser storage) ===
// ひとりで使う練習相手（#1845）の設定を、作品ではなくブラウザに覚える（EPIC #1842 Q9）。
// 提出した作品に練習の設定が混ざらないようにするため、VM・作品の JSON には何も書かない。
//
// - 作品の ID（Google ドライブ・共有など）がある作品: localStorage に作品の ID ごとに覚える。
//     smalruby:meshPracticePartner = { version: 1, projects: { 'id:<作品 ID>': 設定 } }
//   作品の数は MAX_PROJECTS まで（古く書いたものから消す）。
// - 作品の ID が無い作品（新しい作品・ファイルから読んだ作品・クラスの課題など）: 名前は別の作品と
//   ぶつかる（既定の名前・同じファイル名・同じ課題名）ので名前では覚えず、このタブの sessionStorage
//   だけに覚える（タブを閉じると消える）。
//     smalruby:meshPracticePartner = { version: 1, settings: 設定 }
// - 書くのは生徒が練習相手の設定を変えたときだけ（use-mesh-practice-partner.js の updateSettings）。
//   ページを開いた・作品を変えたときは読むだけ（練習相手を使わない人のブラウザに何も残さない）。
import { sanitizeSettings } from './partner';

export const STORAGE_KEY = 'smalruby:meshPracticePartner';
export const MAX_PROJECTS = 20;

// scratch-gui の既定の作品 ID（reducers/project-state.js の defaultProjectId）
const DEFAULT_PROJECT_ID = '0';

const browserStore = (name) => {
    try {
        return typeof window !== 'undefined' && window[name] ? window[name] : null;
    } catch (error) {
        return null;
    }
};

/**
 * 既定の置き場（localStorage と sessionStorage）。
 * @returns {{local: ?object, session: ?object}} 置き場。
 */
export const browserStores = () => ({ local: browserStore('localStorage'), session: browserStore('sessionStorage') });

/**
 * 作品のキー。作品の ID があるときだけ（名前は別の作品とぶつかるので使わない）。
 * @param {{projectId: ?(string|number)}} project - 作品の ID。
 * @returns {?string} キー（ID が無ければ null = このタブだけに覚える）。
 */
export const projectKeyOf = ({ projectId } = {}) => {
    const id = projectId === null || typeof projectId === 'undefined' ? '' : String(projectId);
    return id !== '' && id !== DEFAULT_PROJECT_ID ? `id:${id}` : null;
};

const readJson = (store) => {
    if (!store) return null;
    try {
        const raw = store.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' && parsed.version === 1 ? parsed : null;
    } catch (error) {
        return null;
    }
};

const writeJson = (store, value) => {
    if (!store) return false;
    try {
        store.setItem(STORAGE_KEY, JSON.stringify(value));
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * 覚えている設定を読む。
 * @param {?string} projectKey - 作品のキー（projectKeyOf）。
 * @param {{local: ?object, session: ?object}} [stores] - 置き場（テスト用）。
 * @returns {?object} 設定（覚えていなければ null）。
 */
export const loadPartnerSettings = (projectKey, stores = browserStores()) => {
    if (projectKey) {
        const all = readJson(stores.local);
        const projects = all && all.projects && typeof all.projects === 'object' ? all.projects : {};
        return Object.prototype.hasOwnProperty.call(projects, projectKey)
            ? sanitizeSettings(projects[projectKey])
            : null;
    }
    const tab = readJson(stores.session);
    return tab && tab.settings ? sanitizeSettings(tab.settings) : null;
};

/**
 * 設定を覚える。書けない（容量・プライベートモード）ときは何もしない（練習は続けられる）。
 * @param {?string} projectKey - 作品のキー。
 * @param {object} settings - 設定。
 * @param {{local: ?object, session: ?object}} [stores] - 置き場（テスト用）。
 * @returns {boolean} 書けたら true。
 */
export const savePartnerSettings = (projectKey, settings, stores = browserStores()) => {
    const clean = sanitizeSettings(settings);
    if (!projectKey) return writeJson(stores.session, { version: 1, settings: clean });
    const all = readJson(stores.local) || { version: 1, projects: {} };
    const projects = { ...(all.projects || {}) };
    // 新しく書いたものを最後に置き、古いものから消す
    delete projects[projectKey];
    projects[projectKey] = clean;
    const keys = Object.keys(projects);
    keys.slice(0, Math.max(0, keys.length - MAX_PROJECTS)).forEach((key) => delete projects[key]);
    return writeJson(stores.local, { version: 1, projects });
};
