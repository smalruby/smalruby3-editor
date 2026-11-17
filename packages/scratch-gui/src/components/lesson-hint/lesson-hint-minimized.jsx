// 小さくしたヒントの札。ヒントの吹き出しの「－」を押すと、吹き出しの代わりに課題バーのすぐ下（バーの「ヒント」
// ボタンの下。ステージの列があればその左）に、いまのページの番号と短い見出しの札が残る。押すと同じページで
// 元の大きさにもどる。子どもはヒントを読んで操作するときに閉じてしまい、手順を見失っていたので、小さくしても
// 消えず、「もどしたくなる」ように色の札にする（#2129 の F2）。スポットライトは小さくしたら消す（照らさない）。
// 置き方は lib/lessons/hint-minimized.js の純粋関数。document.body に portal で出す（本体のレイアウトを変えない）。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import { minimizedHintPosition, shortHintHeading } from '../../lib/lessons/hint-minimized';
import { HINT_TARGETS, findHintTargetRect, hintViewport } from '../../lib/lessons/hint-targets';
import { formatRoleMessage } from '../../lib/lessons/role-swap';
import styles from './lesson-hint.css';
import { lessonHintMessages } from './lesson-hint.jsx';

const messages = defineMessages({
    position: {
        id: 'gui.lessonHint.minimizedPosition',
        description: 'Label on the small hint tag that shows which hint page is open, out of how many',
        defaultMessage: 'Hint {number}/{count}',
    },
    restore: {
        id: 'gui.lessonHint.restore',
        description: 'Accessible name and tooltip of the small hint tag. Pressing it shows the hint again',
        defaultMessage: 'Show the hint again',
    },
});

const toRect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.right - r.left > 0 && r.bottom - r.top > 0
        ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
        : null;
};

// ステージの列（旗・止める・ステージの大きさのボタンを含む）。upstream の部品なので CSS Modules のクラス名で探す
const STAGE_COLUMN = '[class*="gui_stage-and-target-wrapper_"]';

const LessonHintMinimized = ({ count, index, lastResort = false, nudge = false, onRestore, title = null }) => {
    const intl = useIntl();
    // 見出しは吹き出しの見出しと同じ文言の最初の文（最後の手段のページは「うまく動かないときは」）
    const heading = shortHintHeading(
        lastResort ? intl.formatMessage(lessonHintMessages.debugTitle) : formatRoleMessage(intl, title),
    );
    const ref = useRef(null);
    const [position, setPosition] = useState(null);
    const measure = useCallback(() => {
        const el = ref.current;
        if (!el || typeof document === 'undefined') return;
        const size = el.getBoundingClientRect();
        const next = minimizedHintPosition({
            bar: toRect(document.querySelector('[data-testid="lesson-task-bar"]')),
            hintButton: toRect(document.querySelector('[data-testid="lesson-task-bar-hint"]')),
            stage: toRect(document.querySelector(STAGE_COLUMN)),
            palette: findHintTargetRect(HINT_TARGETS.PALETTE, document),
            chip: { width: size.width, height: size.height },
            viewport: hintViewport(document, window),
        });
        setPosition((prev) => (prev && prev.left === next.left && prev.top === next.top ? prev : next));
    }, []);
    useLayoutEffect(measure, [measure, index, heading]);
    useEffect(() => {
        // タブの切り替え・ステージの大きさの変更でも動くので、ヒントの吹き出しと同じく短い間隔でも測り直す
        window.addEventListener('resize', measure);
        const timer = window.setInterval(measure, 300);
        return () => {
            window.removeEventListener('resize', measure);
            window.clearInterval(timer);
        };
    }, [measure]);

    if (typeof document === 'undefined') return null;
    const label = intl.formatMessage(messages.position, { number: index + 1, count });
    const restore = intl.formatMessage(messages.restore);
    return createPortal(
        <button
            ref={ref}
            type="button"
            className={nudge ? styles.minimizedNudge : styles.minimized}
            data-testid="lesson-hint-minimized"
            data-nudge={nudge ? 'true' : 'false'}
            aria-label={[restore, label, heading].filter(Boolean).join(' ')}
            title={restore}
            style={position ? { left: position.left, top: position.top } : { visibility: 'hidden' }}
            onClick={onRestore}
        >
            <span className={styles.minimizedPosition} data-testid="lesson-hint-minimized-position">
                {label}
            </span>
            {heading ? (
                <span className={styles.minimizedHeading} data-testid="lesson-hint-minimized-heading">
                    {heading}
                </span>
            ) : null}
            <span className={styles.minimizedRestore} aria-hidden="true">
                ⤢
            </span>
        </button>,
        document.body,
    );
};

LessonHintMinimized.propTypes = {
    count: PropTypes.number.isRequired,
    index: PropTypes.number.isRequired,
    // 最後の手段のページ（うまく動かないときは）か
    lastResort: PropTypes.bool,
    // 手が止まっているので光らせるか（#2132）
    nudge: PropTypes.bool,
    onRestore: PropTypes.func.isRequired,
    // いまのページの文言（message descriptor。lib/lessons/hint-text.js の hintStepTitle）
    title: PropTypes.object,
};

export default LessonHintMinimized;
