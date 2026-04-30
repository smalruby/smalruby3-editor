import PropTypes from 'prop-types';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './mobile-paint-toolbar-toggle.css';

const COLLAPSED_CLASS = 'smalruby-paint-toolbar-collapsed';
const SIDE_RAIL_WIDTH = 48;

/**
 * コスチュームタブの上部ツールバー (`paint-editor_editor-container-top`) を
 * 出し入れするトグルハンドル (issue #572 Phase 2-J)。
 *
 * 横向き iPhone で paint editor の上部ツールバーは sticky で常駐させる
 * (PR-2J Stage 1) が、それでも canvas の縦スペースを 104px ほど食う。
 * このトグルで折りたたむと canvas + ツールが viewport 縦 100% を使え、
 * もう一度タップで戻せる。ブロックパレットの `<PaletteToggle>` と同じ
 * 「出し入れ」UX。
 *
 * - active=false (タブが他): 何も描画しない
 * - active=true: 編集エリア上端中央に細い handle (▼/▲) を固定表示
 *   - collapsed=false → ▼ (タップで折りたたむ)
 *   - collapsed=true  → ▲ (タップで展開する)
 *
 * 折りたたみ中は body に `smalruby-paint-toolbar-collapsed` class を付け、
 * CSS (mobile-gui.css) でその class を起点に `paint-editor_editor-container-top`
 * を `display: none` にする。
 *
 * left 位置はサイドレール (48px) の右隣 + 余白で JS 計算 (画面幅に依存しない)。
 * @param {object} props - props
 * @param {boolean} props.active - costume タブで mobile mode のとき true
 * @param {boolean} props.collapsed - ツールバーが折りたたまれているか
 * @param {Function} props.onToggle - トグルボタン押下時のコールバック
 * @returns {JSX.Element|null} portal で document.body 直下にレンダリング
 */
const MobilePaintToolbarToggle = ({ active, collapsed, onToggle }) => {
    const ref = useRef(null);

    useEffect(() => {
        if (typeof document === 'undefined') return () => {};
        if (active && collapsed) {
            document.body.classList.add(COLLAPSED_CLASS);
        } else {
            document.body.classList.remove(COLLAPSED_CLASS);
        }
        return () => {
            document.body.classList.remove(COLLAPSED_CLASS);
        };
    }, [active, collapsed]);

    useEffect(() => {
        if (!active || !ref.current || typeof window === 'undefined') return () => {};
        const el = ref.current;
        const update = () => {
            // サイドレール 48px の右、編集エリアの中央付近に置く。
            const editorWidth = window.innerWidth - SIDE_RAIL_WIDTH;
            const handleWidth = el.offsetWidth || 60;
            el.style.left = `${SIDE_RAIL_WIDTH + Math.max(8, (editorWidth - handleWidth) / 2)}px`;
        };
        update();
        window.addEventListener('resize', update, { passive: true });
        return () => window.removeEventListener('resize', update);
    }, [active]);

    if (typeof document === 'undefined') return null;
    if (!active) return null;

    return createPortal(
        <button
            ref={ref}
            type="button"
            className={styles.toggle}
            onClick={onToggle}
            data-testid="mobile-paint-toolbar-toggle"
            aria-label={collapsed ? 'show toolbar' : 'hide toolbar'}
            aria-expanded={!collapsed}
        >
            {collapsed ? '▼' : '▲'}
        </button>,
        document.body,
    );
};

MobilePaintToolbarToggle.propTypes = {
    active: PropTypes.bool.isRequired,
    collapsed: PropTypes.bool.isRequired,
    onToggle: PropTypes.func.isRequired,
};

export default MobilePaintToolbarToggle;
