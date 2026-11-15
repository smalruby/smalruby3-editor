// === Smalruby: This file is Smalruby-specific (mesh practice partner: React hook) ===
// ひとりで使う練習相手（#1845）の状態と操作。メッシュの「状態と履歴」のウィンドウ（#1844）の
// コンテナがいつも呼ぶ（ウィンドウを閉じても、練習相手は動き続ける）。
//   - 「練習相手を使う」は、開いたときは切れている。押す（ボタン・返事を作る）と入る。
//     作品を読み込んだとき・本物のメッシュでつなぎ始めたとき（つなぐのに失敗したときも）は切る。
//   - レッスンの練習相手など、ほかの折り返しが動いているあいだは使えない（二重につながない）。
//   - 設定はブラウザに覚える（storage.js）。作品には入れない。書くのは生徒が設定を変えたときだけ。
import { useCallback, useEffect, useRef, useState } from 'react';
import { attachPracticeLoopback, PRACTICE_OWNER_CHANGED, practiceLoopbackOwner } from './loopback';
import {
    emptySettings,
    partnerFromSettings,
    practiceAllowed,
    withButtonValue,
    withoutReply,
    withoutVariable,
    withReply,
    withVariable,
} from './partner';
import { browserStores, loadPartnerSettings, savePartnerSettings } from './storage';

/** このフックがつなぐ折り返しの名前（loopback.js の owner）。 */
export const STANDALONE_OWNER = 'standalone';

const getExtension = (vm) =>
    vm && vm.runtime && vm.runtime.peripheralExtensions ? vm.runtime.peripheralExtensions.meshV2 || null : null;

const connectionStateOf = (vm) => {
    const ext = getExtension(vm);
    return ext ? ext.connectionState : null;
};

const otherOwnerOf = (vm) => {
    const owner = vm && vm.runtime ? practiceLoopbackOwner(vm.runtime) : null;
    return owner && owner !== STANDALONE_OWNER ? owner : null;
};

/**
 * @param {object} options - 設定。
 * @param {object} options.vm - VM。
 * @param {?string} options.projectKey - 作品のキー（storage.js の projectKeyOf）。
 * @param {boolean} [options.lessonPartnerActive] - レッスンの練習相手があるチャレンジを開いているか。
 * @param {object} [options.stores] - `{local, session}`（テスト用）。
 * @returns {object} 練習相手の状態と操作。
 */
export const useMeshPracticePartner = ({ vm, projectKey, lessonPartnerActive = false, stores }) => {
    const storesRef = useRef(stores || browserStores());
    const [settings, setSettings] = useState(
        () => loadPartnerSettings(projectKey, storesRef.current) || emptySettings(),
    );
    // 設定を読み直した回数（画面の欄を、読み直した設定で作り直すため）
    const [loadCount, setLoadCount] = useState(0);
    const [enabled, setEnabled] = useState(false);
    const [allowed, setAllowed] = useState(() => practiceAllowed(connectionStateOf(vm)));
    const [otherOwner, setOtherOwner] = useState(() => otherOwnerOf(vm));
    // 練習相手が何かした（送った・値を入れた）回数。状態と履歴をすぐ描き直すため
    const [revision, setRevision] = useState(0);
    const settingsRef = useRef(settings);
    const loopRef = useRef(null);
    // 「使う」を入れた直後（まだつないでいない）に押されたものを、つないだあとに行う
    const queueRef = useRef([]);
    const keyRef = useRef(projectKey);

    settingsRef.current = settings;

    // 作品のキーが変わった（作品を開いた・ドライブに保存して ID が付いた）。読むだけで書かない。
    // 覚えている設定があれば読み、無ければいまの設定をそのまま使う（生徒が変えたときに新しいキーで覚える）
    useEffect(() => {
        if (keyRef.current === projectKey) return;
        keyRef.current = projectKey;
        const saved = loadPartnerSettings(projectKey, storesRef.current);
        if (saved) {
            settingsRef.current = saved;
            setSettings(saved);
            setLoadCount((n) => n + 1);
            if (loopRef.current) loopRef.current.syncVariables(saved.variables);
        }
    }, [projectKey]);

    // 本物のメッシュのつながり・作品の読み込み・ほかの折り返し
    useEffect(() => {
        if (!vm || !vm.runtime || typeof vm.runtime.on !== 'function') return () => {};
        const update = () => {
            const free = practiceAllowed(connectionStateOf(vm));
            setAllowed(free);
            if (!free) setEnabled(false);
        };
        const onProjectLoaded = () => setEnabled(false);
        const onOwnerChanged = () => setOtherOwner(otherOwnerOf(vm));
        update();
        onOwnerChanged();
        vm.runtime.on('PERIPHERAL_CONNECTED', update);
        vm.runtime.on('PERIPHERAL_DISCONNECTED', update);
        vm.runtime.on('PROJECT_LOADED', onProjectLoaded);
        vm.runtime.on(PRACTICE_OWNER_CHANGED, onOwnerChanged);
        return () => {
            vm.runtime.removeListener('PERIPHERAL_CONNECTED', update);
            vm.runtime.removeListener('PERIPHERAL_DISCONNECTED', update);
            vm.runtime.removeListener('PROJECT_LOADED', onProjectLoaded);
            vm.runtime.removeListener(PRACTICE_OWNER_CHANGED, onOwnerChanged);
        };
    }, [vm]);

    // レッスンの練習相手（チャレンジの partner）か、ほかの折り返しが動いているあいだは使わない
    const blocked = Boolean(lessonPartnerActive || otherOwner);
    useEffect(() => {
        if (blocked) {
            queueRef.current = [];
            setEnabled(false);
        }
    }, [blocked]);

    const usable = allowed && !blocked;
    const active = Boolean(enabled && usable && vm && getExtension(vm));

    // 折り返しをつなぐ・外す
    useEffect(() => {
        if (!active) return () => {};
        const loop = attachPracticeLoopback({
            vm,
            owner: STANDALONE_OWNER,
            getPartner: () => partnerFromSettings(settingsRef.current),
            // 本物のメッシュでつなぎ始めた（イベントは出ない）。失敗して切れたあとも動き出さないよう「使う」を切る
            onSuspend: () => {
                queueRef.current = [];
                setEnabled(false);
            },
        });
        if (!loop) {
            // ほかの折り返しがつないでいた
            queueRef.current = [];
            setEnabled(false);
            return () => {};
        }
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

    // 生徒が設定を変えた: 覚え、つないでいれば相手の変数をそろえる（ここだけが書く）
    const updateSettings = useCallback((next) => {
        if (next === settingsRef.current) return;
        settingsRef.current = next;
        setSettings(next);
        savePartnerSettings(keyRef.current, next, storesRef.current);
        if (loopRef.current) loopRef.current.syncVariables(next.variables);
    }, []);

    // つないでいれば今すぐ、つないでいなければ「使う」を入れてから行う
    const withLoop = useCallback(
        (run) => {
            if (!usable || !getExtension(vm)) return;
            if (loopRef.current) {
                run(loopRef.current);
                setRevision((r) => r + 1);
                return;
            }
            queueRef.current.push(run);
            setEnabled(true);
        },
        [usable, vm],
    );

    const setUse = useCallback(
        (on) => {
            if (!on) queueRef.current = [];
            setEnabled(Boolean(on) && usable);
        },
        [usable],
    );

    const send = useCallback(
        (broadcast, value) => {
            updateSettings(withButtonValue(settingsRef.current, broadcast, value));
            withLoop((loop) => loop.act({ set: [], broadcast, value }));
        },
        [updateSettings, withLoop],
    );

    const setVariable = useCallback(
        (name, value) => {
            updateSettings(withVariable(settingsRef.current, name, value));
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
        blocked,
        enabled,
        loadCount,
        revision,
        settings,
        setUse,
        send,
        setVariable,
        addVariable,
        removeVariable,
        addReply,
        removeReply,
    };
};
