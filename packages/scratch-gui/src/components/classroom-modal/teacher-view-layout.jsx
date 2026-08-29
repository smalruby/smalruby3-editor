/**
 * クラス管理サブ画面の共通レイアウト (#1125)。
 *
 * #1121 / #1122 では、画面ごとにヘッダー・枠・マージン・ボタン行を各 jsx が
 * 自前で組み立てていたためスタイルがずれていた。ここに 2 つのレイアウトを置き、
 * **新しいクラス管理画面はこのどちらかをベースに作るだけでスタイルがそろう**
 * ようにする (ボタンは `classroom-button.jsx` の `ClassroomButton` を使う)。
 *
 * - `TeacherScreen`: パンくずを持つトップレベル画面 (評価画面・クラス一覧など)。
 *   パンくず → タイトル → 説明 → エラー → 本文 → フッター の順を固定する。
 * - `TeacherSubView`: パネル (課題ボード / クラス一覧) の中に描画されるサブ画面
 *   (課題を作る・課題を再利用・クラスを作る・クラス設定・合言葉で取り込み・共有)。
 *   パネル側の左右パディングに二重で足さない `.panel-inner-view` を土台にする。
 *
 * どちらも「タイトル / 説明 / エラー / フッター」はスロットで受け取り、要素と
 * クラスはレイアウト側が持つ。画面側で `<h2 className={styles.xxxTitle}>` を
 * 書き起こさないこと (それがずれの発生源だった)。
 */
import PropTypes from 'prop-types';
import React from 'react';

import ErrorDisplay from './error-display.jsx';
import TeacherBreadcrumbs from './teacher-breadcrumbs.jsx';

import styles from './classroom-modal.css';

const breadcrumbItemsShape = PropTypes.arrayOf(
    PropTypes.shape({
        label: PropTypes.node.isRequired,
        onClick: PropTypes.func,
        testId: PropTypes.string,
    }),
);

/* パンくず付きのトップレベル画面。`className` を渡すと土台のクラスを差し替える
   (パネル自身が土台になる画面用。既定は `.teacher-view`)。 */
export const TeacherScreen = ({
    breadcrumbs,
    children,
    className,
    error,
    errorTitle,
    footer,
    hint,
    testId,
    title,
}) => (
    <div className={className || styles.teacherView} data-testid={testId}>
        {breadcrumbs ? <TeacherBreadcrumbs items={breadcrumbs} /> : null}
        {title ? <h2 className={styles.teacherViewTitle}>{title}</h2> : null}
        {hint ? <p className={styles.teacherViewHint}>{hint}</p> : null}
        <ErrorDisplay error={error} errorTitle={errorTitle} />
        {children}
        {footer ? <div className={styles.buttonRow}>{footer}</div> : null}
    </div>
);

TeacherScreen.propTypes = {
    breadcrumbs: breadcrumbItemsShape,
    children: PropTypes.node,
    className: PropTypes.string,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    /** セカンダリ左・プライマリ右で並べるボタン行。 */
    footer: PropTypes.node,
    hint: PropTypes.node,
    testId: PropTypes.string,
    title: PropTypes.node,
};

/* パネル内サブ画面。`as="form"` にすると `<form>` として描画し `onSubmit` を通す。 */
export const TeacherSubView = ({
    as = 'div',
    children,
    className,
    error,
    errorTitle,
    footer,
    hint,
    testId,
    title,
    onSubmit,
}) => {
    const Container = as;
    // onSubmit は form のときだけ渡す (div に submit ハンドラを付けない)。
    const submitProps = as === 'form' ? { onSubmit } : {};
    return (
        <Container className={className || styles.panelInnerView} data-testid={testId} {...submitProps}>
            {title ? <div className={styles.phaseTitle}>{title}</div> : null}
            {hint ? <p className={styles.teacherViewHint}>{hint}</p> : null}
            <ErrorDisplay error={error} errorTitle={errorTitle} />
            {children}
            {footer ? <div className={styles.formFooter}>{footer}</div> : null}
        </Container>
    );
};

TeacherSubView.propTypes = {
    as: PropTypes.oneOf(['div', 'form']),
    children: PropTypes.node,
    className: PropTypes.string,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    /** セカンダリ左・プライマリ右で並べるボタン行。 */
    footer: PropTypes.node,
    hint: PropTypes.node,
    testId: PropTypes.string,
    title: PropTypes.node,
    onSubmit: PropTypes.func,
};
