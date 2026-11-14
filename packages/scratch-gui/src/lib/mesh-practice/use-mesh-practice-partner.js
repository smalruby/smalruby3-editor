// === Smalruby: This file is Smalruby-specific (mesh practice partner: React hook) ===
// ひとりで使う練習相手（#1845）の状態と操作。メッシュの「状態と履歴」のウィンドウ（#1844）の
// コンテナがいつも呼ぶ（ウィンドウを閉じても、練習相手は動き続ける）。
//   - 「練習相手を使う」は、開いたときは切れている。押す（ボタン・返事を作る）と入る。
//     作品を読み込んだとき・本物のメッシュでつながったときは切る（つないだら本物のメッシュだけ）。
//   - 設定はブラウザに覚える（storage.js）。作品には入れない。
import { useCallback, useEffect, useRef, useState } from 'react';
import { attachPracticeLoopback } from './loopback';
import {
    partnerFromSettings,
    practiceAllowed,
    withButtonValue,
    withoutReply,
    withoutVariable,
    withReply,
    withVariable,
} from './partner';
import { loadPartnerSettings, savePartnerSettings, STORAGE_KEY } from './storage';

const getExtension = (vm) =>
    vm && vm.runtime && vm.runtime.peripheralExtensions ? vm.runtime.peripheralExtensions.meshV2 || null : null;

const connectionStateOf = (vm) => {
    const ext = getExtension(vm);
    return ext ? ext.connectionState : null;
};

const hasSaved = (projectKey, storage) => {
    if (!projectKey || !storage) return false;
    try {
        const all = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
        return Boolean(all && all.projects && Object.prototype.hasOwnProperty.call(all.projects, projectKey));
    } catch (error) {
        return false;
    }
};

const browserStorage = () => {
    try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch (error) {
        return null;
    }
};

/**
 * @param {object} options - 設定。
 * @param {object} options.vm - VM。
 * @param {?string} options.projectKey - 作品のキー（storage.js の projectKeyOf）。
 * @param {?object} [options.storage] - localStorage（テスト用）。
 * @returns {object} 練習相手の状態と操作。
 */
export const useMeshPracticePartner = ({ vm, projectKey, storage = browserStorage() }) => {
    const [settings, setSettings] = useState(() => loadPartnerSettings(projectKey, storage));
    const [enabled, setEnabled] = useState(false);
    const [allowed, setAllowed] = useState(() => practiceAllowed(connectionStateOf(vm)));
    // 練習相手が何かした（送った・値を入れた）回数。状態と履歴をすぐ描き直すため
    const [revision, setRevision] = useState(0);
    const settingsRef = useRef(settings);
    const loopRef = useRef(null);
    // 「使う」を入れた直後（まだつないでいない）に押されたものを、つないだあとに行う
    const queueRef = useRef([]);
    const keyRef = useRef(projectKey);

    settingsRef.current = settings;

    // 作品のキーが変わった（名前を変えた・別の作品を開いた）。覚えている設定があれば読み、
    // 無ければいまの設定をそのまま新しいキーで覚える（名前を変えても設定を失わない）
    useEffect(() => {
        if (keyRef.current === projectKey) return;
        keyRef.current = projectKey;
        if (hasSaved(projectKey, storage)) {
            setSettings(loadPartnerSettings(projectKey, storage));
        } else {
            savePartnerSettings(projectKey, settingsRef.current, storage);
        }
    }, [projectKey, storage]);

    // 本物のメッシュのつながり・作品の読み込み
    useEffect(() => {
        if (!vm || !vm.runtime || typeof vm.runtime.on !== 'function') return () => {};
        const update = () => {
            const free = practiceAllowed(connectionStateOf(vm));
            setAllowed(free);
            if (!free) setEnabled(false);
        };
        const onProjectLoaded = () => setEnabled(false);
        update();
        vm.runtime.on('PERIPHERAL_CONNECTED', update);
        vm.runtime.on('PERIPHERAL_DISCONNECTED', update);
        vm.runtime.on('PROJECT_LOADED', onProjectLoaded);
        return () => {
            vm.runtime.removeListener('PERIPHERAL_CONNECTED', update);
            vm.runtime.removeListener('PERIPHERAL_DISCONNECTED', update);
            vm.runtime.removeListener('PROJECT_LOADED', onProjectLoaded);
        };
    }, [vm]);

    const active = Boolean(enabled && allowed && vm && getExtension(vm));

    // 折り返しをつなぐ・外す
    useEffect(() => {
        if (!active) return () => {};
        const loop = attachPracticeLoopback({ vm, getPartner: () => partnerFromSettings(settingsRef.current) });
        loopRef.current = loop;
        loop.syncVariables(settingsRef.current.variables);
        const queued = queueRef.current;
        queueRef.current = [];
        queued.forEach((run) => run(loop));
        if (queued.length > 0) setRevision((r) => r + 1);
        return () => {
            loop.detach();
            if (loopRef.current === loop) loopRef.current = null;
        };
    }, [active, vm]);

    // 設定を覚え、つないでいれば相手の変数をそろえる
    const updateSettings = useCallback(
        (next) => {
            if (next === settingsRef.current) return;
            settingsRef.current = next;
            setSettings(next);
            savePartnerSettings(keyRef.current, next, storage);
            if (loopRef.current) loopRef.current.syncVariables(next.variables);
        },
        [storage],
    );

    // つないでいれば今すぐ、つないでいなければ「使う」を入れてから行う
    const withLoop = useCallback(
        (run) => {
            if (!allowed || !getExtension(vm)) return;
            if (loopRef.current) {
                run(loopRef.current);
                setRevision((r) => r + 1);
                return;
            }
            queueRef.current.push(run);
            setEnabled(true);
        },
        [allowed, vm],
    );

    const setUse = useCallback(
        (on) => {
            if (!on) queueRef.current = [];
            setEnabled(Boolean(on) && allowed);
        },
        [allowed],
    );

    const send = useCallback(
        (broadcast, value) => {
            updateSettings(withButtonValue(settingsRef.current, broadcast, value));
            withLoop((loop) => loop.act({ set: [], broadcast, value }));
        },
        [updateSettings, withLoop],
    );

    const rememberValue = useCallback(
        (broadcast, value) => updateSettings(withButtonValue(settingsRef.current, broadcast, value)),
        [updateSettings],
    );

    const setVariable = useCallback(
        (name, value) => {
            const next = withVariable(settingsRef.current, name, value);
            updateSettings(next);
            withLoop((loop) => loop.setVariable(name, value));
        },
        [updateSettings, withLoop],
    );

    // 新しく作った変数は値 ''（ドロップダウンに出すため、相手のノードに名前を置く）
    const addVariable = useCallback(
        (name) => {
            const before = settingsRef.current;
            const next = withVariable(before, name, '');
            if (next === before) return false;
            updateSettings(next);
            withLoop((loop) => loop.syncVariables(settingsRef.current.variables));
            return true;
        },
        [updateSettings, withLoop],
    );

    const removeVariable = useCallback(
        (name) => updateSettings(withoutVariable(settingsRef.current, name)),
        [updateSettings],
    );

    const addReply = useCallback(
        (reply) => {
            const before = settingsRef.current;
            const next = withReply(before, reply);
            if (next === before) return false;
            updateSettings(next);
            withLoop(() => {});
            return true;
        },
        [updateSettings, withLoop],
    );

    const removeReply = useCallback(
        (index) => updateSettings(withoutReply(settingsRef.current, index)),
        [updateSettings],
    );

    return {
        active,
        allowed,
        enabled,
        revision,
        settings,
        setUse,
        send,
        rememberValue,
        setVariable,
        addVariable,
        removeVariable,
        addReply,
        removeReply,
    };
};
