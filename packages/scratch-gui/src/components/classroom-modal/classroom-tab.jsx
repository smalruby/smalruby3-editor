/**
 * クラス管理のタブ（#1956 Q7）。
 *
 * 下に線のタブ。選ばれたタブは主の色（`$color-action`）の文字と 3px の線になる。
 * 並びは `<div className={styles.tabList} role="tablist">` で包む（右端に「…」などを
 * 置くときもこの並びの中に置く）。形の決まりは docs/design-system/components/tabs.md の
 * 「クラス管理のタブ」。
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import styles from './classroom-modal.css';

const ClassroomTab = ({ children, dataTab, dataTestId, selected, onClick }) => (
    <button
        aria-selected={selected}
        className={classNames(styles.tab, { [styles.tabSelected]: selected })}
        data-tab={dataTab}
        data-testid={dataTestId}
        role="tab"
        type="button"
        onClick={onClick}
    >
        {children}
    </button>
);

ClassroomTab.propTypes = {
    children: PropTypes.node,
    /** `onClick` の側で `event.currentTarget.dataset.tab` から選んだタブを読むときに使う。 */
    dataTab: PropTypes.string,
    dataTestId: PropTypes.string,
    selected: PropTypes.bool,
    onClick: PropTypes.func,
};

export default ClassroomTab;
