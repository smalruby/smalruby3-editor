/**
 * The charts above the table of the overall grade (#2458, EPIC #2438 F7 / F8).
 *
 * - The S+A+B count and share (target 75% or more; below it, the attention colour and「!」).
 * - The 100% stacked band of S/A/B/C now, and a faint band of the settings when the screen
 *   was opened, so the teacher sees what the change did.
 * - The dots of every seat's weighted average, with the cut lines of S/A/B. A line can be
 *   dragged, or moved with the arrow keys (role="slider"), like the cut fields on the left.
 *
 * The numbers are pure (`overall-chart.js`); this component only draws and reports the
 * moved cut (`onSetCut(grade, value)`, the same setter as the fields).
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { GRADE_TARGETS } from '../../lib/classroom-evaluation/grade-distribution.js';
import {
    axisTicks,
    chartDomain,
    clampCut,
    cutFromFraction,
    dotLayout,
    overallDistribution,
    stackedSegments,
    stepCut,
    toFraction,
} from '../../lib/classroom-evaluation/overall-chart.js';
import styles from './teacher-overall-grade.css';

const messages = defineMessages({
    sab: {
        defaultMessage: 'S+A+B {count} ({percent})',
        description: 'Overall grade chart: seats with S, A or B and their share (#2458)',
        id: 'gui.classroom.overallChart.sab',
    },
    sabTarget: {
        defaultMessage: 'target {min}% or more',
        description: 'Overall grade chart: the target of the S+A+B share (#2458)',
        id: 'gui.classroom.overallChart.sabTarget',
    },
    off: {
        defaultMessage: 'Below the target',
        description: 'Overall grade chart: tooltip of the S+A+B share below its target (#2458)',
        id: 'gui.classroom.overallChart.off',
    },
    graded: {
        defaultMessage: 'Of {graded} seats with an overall grade',
        description: 'Overall grade chart: the base of the shares (#2458)',
        id: 'gui.classroom.overallChart.graded',
    },
    now: {
        defaultMessage: 'Now',
        description: 'Overall grade chart: label of the stacked band of the current settings (#2458)',
        id: 'gui.classroom.overallChart.now',
    },
    before: {
        defaultMessage: 'When opened',
        description:
            'Overall grade chart: label of the faint stacked band of the settings when the screen was opened (#2458)',
        id: 'gui.classroom.overallChart.before',
    },
    dots: {
        defaultMessage: 'Averages',
        description: 'Overall grade chart: label of the dots of every seat average (#2458)',
        id: 'gui.classroom.overallChart.dots',
    },
    cutLine: {
        defaultMessage: 'Cut of {grade}',
        description: 'Overall grade chart: accessible name of a draggable cut line (#2458)',
        id: 'gui.classroom.overallChart.cutLine',
    },
    dragHint: {
        defaultMessage: 'Drag a line (or use the arrow keys) to move the cut.',
        description: 'Overall grade chart: how to move a cut line (#2458)',
        id: 'gui.classroom.overallChart.dragHint',
    },
    dotTitle: {
        defaultMessage: 'Seat {seat}: {average} ({grade})',
        description: 'Overall grade chart: tooltip of the dot of a seat (#2458)',
        id: 'gui.classroom.overallChart.dotTitle',
    },
});

const CUT_KEYS = ['S', 'A', 'B'];
const CUT_LABEL_CLASS = { S: null, A: styles.cutLabelA, B: styles.cutLabelB };
const GRADE_CLASS = { S: styles.gradeS, A: styles.gradeA, B: styles.gradeB, C: styles.gradeC };
// The dots are 0.5rem; past this many in one place they are drawn closer together.
const DOT_ROWS = 9;

/* 100% の積み上げ帯 1 本。 */
const StackedBand = ({ dataTestId, distribution, faint, label }) => (
    <div className={styles.bandRow}>
        <span className={styles.bandLabel}>{label}</span>
        <div className={classNames(styles.band, { [styles.bandFaint]: faint })} data-testid={dataTestId}>
            {stackedSegments(distribution).map((segment) =>
                segment.count > 0 ? (
                    <span
                        className={classNames(styles.segment, GRADE_CLASS[segment.grade])}
                        data-count={segment.count}
                        data-testid={`${dataTestId}-${segment.grade}`}
                        key={segment.grade}
                        style={{ width: `${segment.share}%` }}
                        title={`${segment.grade} ${segment.count}`}
                    >
                        {`${segment.grade} ${segment.count}`}
                    </span>
                ) : null,
            )}
        </div>
    </div>
);

StackedBand.propTypes = {
    dataTestId: PropTypes.string.isRequired,
    distribution: PropTypes.object.isRequired,
    faint: PropTypes.bool,
    label: PropTypes.string.isRequired,
};

/* 区切りの線 1 本: ドラッグか矢印のキーで動かす。 */
const CutLine = ({ cuts, domain, grade, trackRef, onSetCut }) => {
    const intl = useIntl();
    // While dragging: where the pointer and the line were when pressed. The line moves by
    // how far the pointer moved, so pressing a little beside the line does not move the cut.
    const drag = useRef(null);
    const value = cuts[grade];
    const moveTo = useCallback(
        (clientX) => {
            const track = trackRef.current;
            if (!track || !drag.current) return;
            const rect = track.getBoundingClientRect();
            if (!rect.width) return;
            const fraction = drag.current.fraction + (clientX - drag.current.clientX) / rect.width;
            const next = clampCut(grade, cutFromFraction(fraction, domain), cuts, domain);
            if (next !== value) onSetCut(grade, next);
        },
        [trackRef, domain, grade, cuts, value, onSetCut],
    );
    const handlePointerDown = useCallback(
        (e) => {
            drag.current = { clientX: e.clientX, fraction: toFraction(value, domain) };
            if (e.currentTarget.setPointerCapture && typeof e.pointerId === 'number') {
                e.currentTarget.setPointerCapture(e.pointerId);
            }
            e.preventDefault();
        },
        [value, domain],
    );
    const handlePointerMove = useCallback((e) => moveTo(e.clientX), [moveTo]);
    // The last move already set the cut; a cancelled pointer (its position may be 0) only stops.
    const handlePointerEnd = useCallback(() => {
        drag.current = null;
    }, []);
    const handleKeyDown = useCallback(
        (e) => {
            const steps = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
            if (!steps) return;
            e.preventDefault();
            const next = stepCut(grade, cuts, steps, domain);
            if (next !== value) onSetCut(grade, next);
        },
        [grade, cuts, domain, value, onSetCut],
    );
    return (
        <div
            aria-label={intl.formatMessage(messages.cutLine, { grade })}
            aria-valuemax={domain.max}
            aria-valuemin={domain.min}
            aria-valuenow={value}
            className={styles.cutLine}
            data-testid={`classroom-overall-chart-cut-${grade}`}
            role="slider"
            style={{ left: `${toFraction(value, domain) * 100}%` }}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onPointerCancel={handlePointerEnd}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
        >
            <span className={classNames(styles.cutLabel, CUT_LABEL_CLASS[grade])}>{`${grade} ≥ ${value}`}</span>
        </div>
    );
};

CutLine.propTypes = {
    cuts: PropTypes.object.isRequired,
    domain: PropTypes.object.isRequired,
    grade: PropTypes.string.isRequired,
    trackRef: PropTypes.object.isRequired,
    onSetCut: PropTypes.func.isRequired,
};

/**
 * The charts of the overall grade.
 * @param {object} props - the rows and the settings
 * @param {Array<object>} props.rows - the rows of `computeOverall` with the current settings
 * @param {Array<object>} props.baselineRows - the rows with the settings when the screen was opened
 * @param {object} props.points - grade → points as numbers
 * @param {object} props.cuts - the cuts as numbers
 * @param {Function} props.onSetCut - (grade, value) → set a cut
 * @returns {React.ReactElement} the charts
 */
const TeacherOverallChart = ({ baselineRows, cuts, points, rows, onSetCut }) => {
    const intl = useIntl();
    const trackRef = useRef(null);
    const distribution = overallDistribution(rows);
    const baseline = overallDistribution(baselineRows);
    const domain = chartDomain(points);
    const dots = dotLayout(rows, domain);
    const maxLevel = dots.reduce((max, dot) => Math.max(max, dot.level), 0);
    // Each stacked dot is lifted by 1 row (0.45rem), or closer when there are many in one place.
    const lift = maxLevel + 1 > DOT_ROWS ? (0.45 * DOT_ROWS) / (maxLevel + 1) : 0.45;
    const { sab } = distribution;
    const ticks = axisTicks(domain);

    return (
        <div className={styles.chart} data-testid="classroom-overall-chart">
            <div className={styles.chartSummary}>
                <span
                    className={classNames(styles.chartShare, { [styles.chartShareOff]: !sab.ok })}
                    data-ok={sab.ok}
                    data-testid="classroom-overall-chart-sab"
                    title={sab.ok ? null : intl.formatMessage(messages.off)}
                >
                    {sab.ok ? null : <b>{'!'}</b>}
                    <b>
                        {intl.formatMessage(messages.sab, {
                            count: sab.count,
                            percent: sab.percent === null ? '—' : `${sab.percent}%`,
                        })}
                    </b>
                    <span className={styles.chartMuted}>
                        {intl.formatMessage(messages.sabTarget, { min: GRADE_TARGETS.sabMin })}
                    </span>
                </span>
                <span className={styles.chartMuted}>
                    {intl.formatMessage(messages.graded, { graded: distribution.graded })}
                </span>
                <span className={styles.chartMuted}>{intl.formatMessage(messages.dragHint)}</span>
            </div>
            <StackedBand
                dataTestId="classroom-overall-chart-band"
                distribution={distribution}
                label={intl.formatMessage(messages.now)}
            />
            <StackedBand
                faint
                dataTestId="classroom-overall-chart-band-before"
                distribution={baseline}
                label={intl.formatMessage(messages.before)}
            />
            <div className={styles.bandRow}>
                <span className={styles.bandLabel}>{intl.formatMessage(messages.dots)}</span>
                <div className={styles.dotArea}>
                    <div className={styles.dotTrack} data-testid="classroom-overall-chart-dots" ref={trackRef}>
                        {dots.map((dot) => (
                            <span
                                className={classNames(styles.dot, GRADE_CLASS[dot.grade])}
                                data-testid={`classroom-overall-chart-dot-${dot.seatNumber}`}
                                key={dot.seatNumber}
                                style={{ left: `${dot.fraction * 100}%`, bottom: `${dot.level * lift}rem` }}
                                title={intl.formatMessage(messages.dotTitle, {
                                    seat: String(dot.seatNumber).padStart(2, '0'),
                                    average: dot.average.toFixed(2),
                                    grade: dot.grade,
                                })}
                            />
                        ))}
                        {CUT_KEYS.map((grade) => (
                            <CutLine
                                cuts={cuts}
                                domain={domain}
                                grade={grade}
                                key={grade}
                                trackRef={trackRef}
                                onSetCut={onSetCut}
                            />
                        ))}
                    </div>
                    <div className={styles.axis}>
                        {ticks.map((t) => (
                            <span className={styles.tick} key={t} style={{ left: `${toFraction(t, domain) * 100}%` }}>
                                {t}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

TeacherOverallChart.propTypes = {
    baselineRows: PropTypes.arrayOf(PropTypes.object).isRequired,
    cuts: PropTypes.object.isRequired,
    points: PropTypes.object.isRequired,
    rows: PropTypes.arrayOf(PropTypes.object).isRequired,
    onSetCut: PropTypes.func.isRequired,
};

export default TeacherOverallChart;
