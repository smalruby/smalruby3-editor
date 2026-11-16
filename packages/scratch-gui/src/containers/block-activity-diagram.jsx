// ブロックを右クリック →「アクティビティ図」で、そのブロックのあるスクリプトのアクティビティ図をパネルに描く
// （#1647・docs/lessons/design.md の「アクティビティ図」の「描く」）。
// - メニューの項目は scratch-blocks（Blockly）の ContextMenuRegistry に足す（upstream のファイルを変えない）。
// - 図のもとは VM の target のブロック。描き方はレッスンの答えから描く図と同じ（model.js / layout.js /
//   lesson-activity-diagram.jsx）。
// - 開いている間はブロックを変えると図も描き直す（作品が変わった合図 PROJECT_CHANGED で読み直す）。
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useSelector } from 'react-redux';
import BlockActivityDiagram from '../components/block-activity-diagram/block-activity-diagram.jsx';
import { en } from '../lib/lessons/activity-diagram/activity-diagram.locale';
import { scriptActivityDiagram } from '../lib/lessons/activity-diagram/script-diagram';

export const MENU_ITEM_ID = 'smalrubyActivityDiagram';
const P = 'gui.lessons.activityDiagram.';
// 開いたときの位置: 右上（ステージの上）。後ろのブロックを隠さないように
const MARGIN = 16;
const TOP = 56;
// 描き直しをまとめる時間（文字を打つたびに描き直さない）
const REDRAW_DELAY = 150;

/**
 * 右クリックしたブロックにメニューの項目を出すか。パレット（フライアウト）のブロックと、値のブロック
 * だけのスクリプト（どこにもつながっていない「x座標」など。図にする流れが無い）には出さない。
 * @param {?object} block - Blockly のブロック。
 * @returns {boolean} 出すか。
 */
export const showsActivityDiagramMenuItem = (block) => {
    if (!block || block.isInFlyout || (block.workspace && block.workspace.isFlyout)) return false;
    const root = typeof block.getRootBlock === 'function' ? block.getRootBlock() : block;
    return !root.outputConnection;
};

const targetName = (target, format) => {
    if (!target) return '';
    if (target.isStage) return format(`${P}stage`);
    return typeof target.getName === 'function' ? target.getName() : (target.sprite && target.sprite.name) || '';
};

const BlockActivityDiagramContainer = () => {
    const intl = useIntl();
    const vm = useSelector((state) => state.scratchGui.vm);
    const scratchBlocks = useSelector((state) => state.scratchGui.blockDisplay.scratchBlocks);
    // 開いている図: どの target の、どのブロックを右クリックしたか
    const [opened, setOpened] = useState(null);
    const [version, setVersion] = useState(0);
    const [position, setPosition] = useState({ x: MARGIN, y: TOP });
    const panelRef = useRef(null);
    const openedRef = useRef(null);
    openedRef.current = opened;
    // 次に描いたときに右上へ置き直すか
    const placeRef = useRef(false);

    const format = useCallback(
        (id, values) => intl.formatMessage({ id, defaultMessage: en[id] || id }, values),
        [intl],
    );

    // メニューの項目はレジストリに 1 度だけ足す。文言と開き方は最新のものを ref から読む
    const labelRef = useRef(null);
    labelRef.current = () => format(`${P}blockMenu`);
    const openRef = useRef(null);
    openRef.current = (block) => {
        const target = vm && vm.editingTarget;
        if (!target || !block) return;
        // 閉じているところから開くときは、右上に置き直す（位置は描いたあとに幅を測って決める）
        if (!openedRef.current) placeRef.current = true;
        setOpened({ targetId: target.id, blockId: block.id });
    };

    useEffect(() => {
        const registry =
            scratchBlocks && scratchBlocks.ContextMenuRegistry && scratchBlocks.ContextMenuRegistry.registry;
        if (!registry) return () => {};
        if (registry.getItem(MENU_ITEM_ID)) registry.unregister(MENU_ITEM_ID);
        registry.register({
            id: MENU_ITEM_ID,
            scopeType: scratchBlocks.ContextMenuRegistry.ScopeType.BLOCK,
            // 上流の項目（複製・コメント・削除など）の下に出す
            weight: 20,
            displayText: () => labelRef.current(),
            preconditionFn: (scope) => (showsActivityDiagramMenuItem(scope.block) ? 'enabled' : 'hidden'),
            callback: (scope) => openRef.current(scope.block),
        });
        return () => {
            if (registry.getItem(MENU_ITEM_ID)) registry.unregister(MENU_ITEM_ID);
        };
    }, [scratchBlocks]);

    // 開いている間は、ブロックを変えたら描き直す
    useEffect(() => {
        if (!opened || !vm) return () => {};
        let timer = null;
        const onChanged = () => {
            clearTimeout(timer);
            timer = setTimeout(() => setVersion((v) => v + 1), REDRAW_DELAY);
        };
        vm.on('PROJECT_CHANGED', onChanged);
        return () => {
            clearTimeout(timer);
            vm.removeListener('PROJECT_CHANGED', onChanged);
        };
    }, [opened, vm]);

    const handleClose = useCallback(() => setOpened(null), []);

    useEffect(() => {
        if (!opened) return () => {};
        const onKeyDown = (e) => {
            if (e.key === 'Escape') setOpened(null);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [opened]);

    const target = opened && vm ? vm.runtime.getTargetById(opened.targetId) : null;
    const diagram = useMemo(() => {
        if (!opened || !target) return null;
        // ワークスペースに出ているブロック（いま選んでいるスプライトのもの）は、その文をそのまま使える
        const workspace =
            scratchBlocks && vm.editingTarget && vm.editingTarget.id === opened.targetId
                ? scratchBlocks.getMainWorkspace()
                : null;
        const liveBlock = (block) => (workspace ? workspace.getBlockById(block.id) : null);
        const msg = scratchBlocks && scratchBlocks.Msg;
        return scriptActivityDiagram(target.blocks._blocks, opened.blockId, {
            format,
            blockName: msg ? (opcode) => msg[opcode.toUpperCase()] || null : null,
            // 拡張機能のブロックの文は Msg に無いので、ワークスペースのブロックの文を使う
            blockText: (block) => {
                const live = liveBlock(block);
                return live ? live.toString() : null;
            },
            // 拡張機能の「〜とき」のように opcode で分からない帽子は、上につながらない形で見分ける
            isHat: (block) => {
                const live = liveBlock(block);
                return Boolean(live && !live.previousConnection && !live.outputConnection);
            },
        });
        // version: ブロックが変わった合図
    }, [opened, target, version, format, scratchBlocks]);

    const layout = diagram ? diagram.layout : null;

    // 図の幅が変わっても画面の右からはみ出さないように寄せる
    useLayoutEffect(() => {
        if (!opened || !panelRef.current) return;
        const width = panelRef.current.offsetWidth;
        if (placeRef.current) {
            placeRef.current = false;
            setPosition({ x: Math.max(MARGIN, window.innerWidth - width - MARGIN), y: TOP });
            return;
        }
        setPosition((p) => {
            const x = Math.max(MARGIN, Math.min(p.x, window.innerWidth - width - MARGIN));
            return x === p.x ? p : { ...p, x };
        });
    }, [opened, layout]);

    const handleDrag = useCallback((e, data) => setPosition({ x: data.x, y: data.y }), []);

    if (!opened) return null;
    return (
        <BlockActivityDiagram
            layout={layout}
            name={targetName(target, format)}
            panelRef={panelRef}
            position={position}
            onClose={handleClose}
            onDrag={handleDrag}
        />
    );
};

export default BlockActivityDiagramContainer;
