// 答えのプログラムから描いたアクティビティ図（lib/lessons/activity-diagram の置き方）を SVG にする。
// 記号は docs/lessons/design.md の「アクティビティ図」: 開始（黒丸）・終了（二重丸）・処理（角の丸い箱）・
// 分岐（ひし形）・合流（小さなひし形）・くり返し（点線の枠）。スクリーンショットは使わない。
// 課題の全文（lesson-task-bar）とヒントの 1 ページ目（lesson-hint）で使う。
import PropTypes from 'prop-types';
import React, { useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    DIAGRAM_SHAPES,
    FONT_SIZE,
    MIN_DIAGRAM_SCALE,
    SMALL_FONT_SIZE,
} from '../../lib/lessons/activity-diagram/layout';
import styles from './lesson-activity-diagram.css';

const messages = defineMessages({
    ariaLabel: {
        id: 'gui.lessons.activityDiagram.ariaLabel',
        description: 'Accessible name of the activity diagram drawn from the answer program of a lesson challenge',
        defaultMessage: 'Activity diagram',
    },
});

const LINE_HEIGHT = 15;
const SMALL_LINE_HEIGHT = 14;

// 行の並びを、cy を真ん中にして縦に並べる
const Lines = ({ lines, x, cy, anchor = 'middle', small = false }) => {
    const lineHeight = small ? SMALL_LINE_HEIGHT : LINE_HEIGHT;
    const size = small ? SMALL_FONT_SIZE : FONT_SIZE;
    const top = cy - (lines.length * lineHeight) / 2;
    return (
        <text className={small ? styles.smallText : styles.text} textAnchor={anchor}>
            {lines.map((line, i) => (
                <tspan key={i} x={x} y={top + lineHeight * i + (lineHeight + size) / 2 - 2}>
                    {line}
                </tspan>
            ))}
        </text>
    );
};

Lines.propTypes = {
    anchor: PropTypes.string,
    cy: PropTypes.number.isRequired,
    lines: PropTypes.arrayOf(PropTypes.string).isRequired,
    small: PropTypes.bool,
    x: PropTypes.number.isRequired,
};

const diamond = ({ x, y, w, h }) => `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`;

const Shape = ({ shape }) => {
    const { type, x, y, w, h } = shape;
    const cx = x + w / 2;
    const cy = y + h / 2;
    switch (type) {
        case DIAGRAM_SHAPES.START:
            return (
                <g data-shape={type}>
                    <circle className={styles.solid} cx={cx} cy={cy} r={w / 2} />
                    {shape.lines && shape.lines.length > 0 ? (
                        <Lines lines={shape.lines} x={x + w + 6} cy={cy} anchor="start" small />
                    ) : null}
                </g>
            );
        case DIAGRAM_SHAPES.END:
            return (
                <g data-shape={type}>
                    <circle className={styles.shape} cx={cx} cy={cy} r={w / 2} />
                    <circle className={styles.solid} cx={cx} cy={cy} r={w / 2 - 3.5} />
                </g>
            );
        case DIAGRAM_SHAPES.ACTION:
            return (
                <g data-shape={type}>
                    <rect className={styles.shape} x={x} y={y} width={w} height={h} rx={Math.min(h / 2, 12)} />
                    <Lines lines={shape.lines} x={cx} cy={cy} />
                </g>
            );
        case DIAGRAM_SHAPES.DECISION:
            return (
                <g data-shape={type}>
                    <polygon className={styles.shape} points={diamond(shape)} />
                    <Lines lines={shape.lines} x={cx} cy={cy} />
                </g>
            );
        case DIAGRAM_SHAPES.MERGE:
            return <polygon data-shape={type} className={styles.shape} points={diamond(shape)} />;
        case DIAGRAM_SHAPES.LOOP:
            return (
                <g data-shape={type}>
                    <rect className={styles.loop} x={x} y={y} width={w} height={h} rx={4} />
                    <text className={styles.smallText} x={x + 6} y={y + 14}>
                        {shape.label}
                    </text>
                </g>
            );
        case DIAGRAM_SHAPES.GUARD:
            return (
                <text
                    data-shape={type}
                    className={styles.smallText}
                    x={shape.anchor === 'end' ? x + w : x}
                    y={y + h - 3}
                    textAnchor={shape.anchor}
                >
                    {shape.label}
                </text>
            );
        case DIAGRAM_SHAPES.LANE:
            return (
                <g data-shape={type}>
                    <rect className={styles.lane} x={x} y={y} width={w} height={h} />
                    <line className={styles.lane} x1={x} y1={y + shape.headerH} x2={x + w} y2={y + shape.headerH} />
                    <text className={styles.laneTitle} x={cx} y={y + shape.headerH / 2 + 4} textAnchor="middle">
                        {shape.label}
                    </text>
                </g>
            );
        case DIAGRAM_SHAPES.CAPTION:
            return (
                <text data-shape={type} className={styles.caption} x={x} y={y + h - 3}>
                    {shape.label}
                </text>
            );
        default:
            return null;
    }
};

Shape.propTypes = {
    shape: PropTypes.shape({
        type: PropTypes.string.isRequired,
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired,
        w: PropTypes.number.isRequired,
        h: PropTypes.number.isRequired,
        // 箱・ひし形・開始の文の行
        lines: PropTypes.arrayOf(PropTypes.string),
        label: PropTypes.string,
        // 分岐の「はい」「いいえ」の寄せ方（start / end）
        anchor: PropTypes.string,
        // レーンの見出しの高さ
        headerH: PropTypes.number,
    }).isRequired,
};

const LessonActivityDiagram = ({ className = null, layout, scale = null }) => {
    const intl = useIntl();
    // 課題の全文とヒントで同時に描くことがあるので、矢じりなどの id はコンポーネントごとに分ける
    const idBase = `lesson-activity-diagram-${useId().replace(/:/g, '')}`;
    const markerId = `${idBase}-arrow`;
    const descId = `${idBase}-desc`;
    // スクリプトが 1 つも無い図（空の枠）は描かない
    if (!layout || layout.shapes.length === 0) return null;
    // scale があればその大きさで描く。無ければ入れる場所の CSS（max-width / max-height）で縮み、
    // 字が読めなくならないよう下限（MIN_DIAGRAM_SCALE）より小さくはしない（入らなければ入れる側がスクロールさせる）
    const sizeStyle =
        scale === null
            ? { minWidth: layout.width * MIN_DIAGRAM_SCALE, minHeight: layout.height * MIN_DIAGRAM_SCALE }
            : { width: layout.width * scale, height: layout.height * scale, maxWidth: 'none', maxHeight: 'none' };
    // レーンの枠 → 矢印 → 記号の順に描く（記号の白で線の端が隠れるように）
    const lanes = layout.shapes.filter((s) => s.type === DIAGRAM_SHAPES.LANE);
    const others = layout.shapes.filter((s) => s.type !== DIAGRAM_SHAPES.LANE);
    return (
        <svg
            className={className ? `${styles.diagram} ${className}` : styles.diagram}
            data-testid="lesson-activity-diagram"
            role="img"
            aria-label={intl.formatMessage(messages.ariaLabel)}
            aria-describedby={layout.description ? descId : null}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            width={layout.width}
            height={layout.height}
            // 縦の上限で縮んだときも左上にそろえる（幅だけ残って真ん中に寄らないように）
            preserveAspectRatio="xMinYMin meet"
            style={sizeStyle}
            xmlns="http://www.w3.org/2000/svg"
        >
            <title>{intl.formatMessage(messages.ariaLabel)}</title>
            {/* 流れを文にした代わりの文（スクリーンリーダー向け。「読んで作る」は図だけで指示するため） */}
            {layout.description ? <desc id={descId}>{layout.description}</desc> : null}
            <defs>
                <marker
                    id={markerId}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto"
                >
                    <path d="M0,0 L10,5 L0,10 z" className={styles.solid} />
                </marker>
            </defs>
            {lanes.map((shape, i) => (
                <Shape key={`lane-${i}`} shape={shape} />
            ))}
            {layout.edges.map((edge, i) => (
                <polyline
                    key={`edge-${i}`}
                    data-edge={i}
                    className={styles.line}
                    points={edge.points.map((p) => p.join(',')).join(' ')}
                    {...(edge.arrow ? { markerEnd: `url(#${markerId})` } : {})}
                />
            ))}
            {others.map((shape, i) => (
                <Shape key={`shape-${i}`} shape={shape} />
            ))}
        </svg>
    );
};

LessonActivityDiagram.propTypes = {
    className: PropTypes.string,
    // lib/lessons/activity-diagram/layout.js の layoutActivityDiagram の戻り値。無ければ何も描かない
    layout: PropTypes.shape({
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired,
        shapes: PropTypes.arrayOf(PropTypes.object).isRequired,
        edges: PropTypes.arrayOf(PropTypes.object).isRequired,
        // 流れを文にした代わりの文（challenge-diagram.js が付ける）
        description: PropTypes.string,
    }),
    // 描く倍率（課題の全文のように、入れる側が大きさを決めるとき）。無ければ CSS で縮み、下限で止まる
    scale: PropTypes.number,
};

export default LessonActivityDiagram;
