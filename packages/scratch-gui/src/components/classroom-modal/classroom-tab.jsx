/**
 * クラス管理のタブ（#1956 Q7）。
 *
 * 下に線のタブ。選ばれたタブは主の色（`$color-action`）の文字と 3px の線になる。
 * 並びは `<div className={styles.tabList} role="tablist">` で包む。右端に「…」や
 * ［⚙ クラスの設定］のようなボタンを置くときは、tablist の中には入れず、tablist と
 * 同じ行の flex に並べる（タブではないものを矢印キー・読み上げのタブの並びに混ぜない）。形の決まりは docs/design-system/components/tabs.md の
 * 「クラス管理のタブ」。
 *
 * キーボード: Tab で入るのは選ばれたタブだけ（ほかは tabIndex=-1・ロービング）。左右の矢印・
 * Home・End で同じ並びのタブへフォーカスを動かし、Enter / Space で選ぶ（手動で選ぶ方式）。
 * 矢印で選ぶまで動かさないのは、タブを選ぶとメンバーの取得などが始まる画面があるため。
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import styles from './classroom-modal.css';

const KEY_STEPS = {
    ArrowLeft: -1,
    ArrowRight: 1,
};

/**
 * 押されたキーから、同じ並びの中で次にフォーカスするタブの位置を決める。
 * @param {string} key - `KeyboardEvent.key`
 * @param {number} index - いまのタブの位置
 * @param {number} count - 並びのタブの数
 * @returns {number|null} 次の位置。動かないキーは null
 */
const nextTabIndex = (key, index, count) => {
    if (count <= 0 || index < 0) return null;
    if (key === 'Home') return 0;
    if (key === 'End') return count - 1;
    const step = KEY_STEPS[key];
    if (!step) return null;
    return (index + step + count) % count;
};

const ClassroomTab = ({ children, dataTab, dataTestId, selected, onClick }) => {
    const handleKeyDown = useCallback((event) => {
        const list = event.currentTarget.closest('[role="tablist"]');
        if (!list) return;
        const tabs = Array.from(list.querySelectorAll('[role="tab"]:not(:disabled)'));
        const next = nextTabIndex(event.key, tabs.indexOf(event.currentTarget), tabs.length);
        if (next === null) return;
        event.preventDefault();
        tabs[next].focus();
    }, []);

    return (
        <button
            aria-selected={selected}
            className={classNames(styles.tab, { [styles.tabSelected]: selected })}
            data-tab={dataTab}
            data-testid={dataTestId}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
            onClick={onClick}
            onKeyDown={handleKeyDown}
        >
            {children}
        </button>
    );
};

ClassroomTab.propTypes = {
    children: PropTypes.node,
    /** `onClick` の側で `event.currentTarget.dataset.tab` から選んだタブを読むときに使う。 */
    dataTab: PropTypes.string,
    dataTestId: PropTypes.string,
    selected: PropTypes.bool,
    onClick: PropTypes.func,
};

export { nextTabIndex };
export default ClassroomTab;
