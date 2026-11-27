/**
 * A carousel: slides that move by themselves, with the same "previous / next"
 * buttons and dots as the pager of our own screens.
 *
 * The look is the pager (docs/design-system/components/pager.md). This part only
 * adds the rules for moving by itself (docs/design-system/components/carousel.md):
 * every 7 seconds, stopped while the mouse is over it or the focus is inside it,
 * a pause button, and no automatic moving for people who ask for less motion
 * (WCAG 2.2, 2.2.2).
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import nextIcon from '../cards/icon--next.svg';
import prevIcon from '../cards/icon--prev.svg';
import styles from './carousel.css';

const messages = defineMessages({
    prev: {
        id: 'gui.carousel.prev',
        defaultMessage: 'Previous',
        description: 'Button to show the previous slide of a carousel',
    },
    next: {
        id: 'gui.carousel.next',
        defaultMessage: 'Next',
        description: 'Button to show the next slide of a carousel',
    },
    pause: {
        id: 'gui.carousel.pause',
        defaultMessage: 'Pause',
        description: 'Button to stop a carousel from moving to the next slide by itself',
    },
    play: {
        id: 'gui.carousel.play',
        defaultMessage: 'Play',
        description: 'Button to let a carousel move to the next slide by itself again',
    },
    slide: {
        id: 'gui.carousel.slide',
        defaultMessage: '{current} of {total}',
        description: 'Which slide of a carousel is shown, read by screen readers',
    },
});

// Long enough to read a heading and two lines of text (#2364).
const DEFAULT_INTERVAL = 7000;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const matchReducedMotion = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
    return window.matchMedia(REDUCED_MOTION_QUERY);
};

/**
 * Whether the person asked for less motion. Follows changes of the setting.
 * @returns {boolean} true when the carousel must not move by itself.
 */
const usePrefersReducedMotion = () => {
    const [reduced, setReduced] = useState(() => Boolean(matchReducedMotion()?.matches));
    useEffect(() => {
        const mql = matchReducedMotion();
        if (!mql || typeof mql.addEventListener !== 'function') return;
        const handleChange = (event) => setReduced(event.matches);
        mql.addEventListener('change', handleChange);
        return () => mql.removeEventListener('change', handleChange);
    }, []);
    return reduced;
};

// Arrow keys must not take the caret away from someone typing.
const isTextTarget = (target) =>
    target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

const Carousel = ({ className, interval = DEFAULT_INTERVAL, label, slides, testId = 'carousel' }) => {
    const intl = useIntl();
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const reducedMotion = usePrefersReducedMotion();
    const total = slides.length;
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const rotating = !reducedMotion && !paused && total > 1;
    const moving = rotating && !hovered && !focused;

    // A timeout per slide, so moving by hand starts the 7 seconds again.
    useEffect(() => {
        if (!moving) return;
        const timer = setTimeout(() => setIndex((prev) => (prev + 1) % total), interval);
        return () => clearTimeout(timer);
    }, [moving, index, interval, total]);

    const handlePrev = useCallback(() => setIndex((prev) => Math.max(prev - 1, 0)), []);
    const handleNext = useCallback(() => setIndex((prev) => Math.min(prev + 1, total - 1)), [total]);
    const handlePauseToggle = useCallback(() => setPaused((prev) => !prev), []);
    const handleMouseEnter = useCallback(() => setHovered(true), []);
    const handleMouseLeave = useCallback(() => setHovered(false), []);
    const handleFocus = useCallback(() => setFocused(true), []);
    const handleBlur = useCallback((event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    }, []);
    const handleKeyDown = useCallback(
        (event) => {
            if (isTextTarget(event.target)) return;
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            const isRtl =
                typeof window !== 'undefined' && window.getComputedStyle(event.currentTarget).direction === 'rtl';
            const forward = (event.key === 'ArrowRight') !== isRtl;
            if (forward) handleNext();
            else handlePrev();
            event.preventDefault();
        },
        [handleNext, handlePrev],
    );

    if (total === 0) return null;
    return (
        <section
            aria-label={label}
            aria-roledescription="carousel"
            className={classNames(styles.carousel, className)}
            data-testid={testId}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className={styles.pager}>
                <button
                    aria-disabled={isFirst}
                    aria-label={intl.formatMessage(messages.prev)}
                    className={styles.pagerButton}
                    data-testid={`${testId}-prev`}
                    type="button"
                    onClick={isFirst ? null : handlePrev}
                >
                    <img alt="" className={styles.pagerIcon} draggable={false} src={prevIcon} />
                </button>
                {/* Read the new slide aloud only when the person moved it (WAI-ARIA carousel pattern). */}
                <div aria-live={rotating ? 'off' : 'polite'} className={styles.content}>
                    {/* Every slide is drawn in the same place, and only the current one is
                    visible: the images are loaded once, and the height stays the tallest
                    slide's, so the buttons do not jump when the slide changes. */}
                    {slides.map((item, i) => (
                        <div
                            aria-hidden={i === index ? null : true}
                            aria-label={intl.formatMessage(messages.slide, { current: i + 1, total })}
                            aria-roledescription="slide"
                            className={classNames(styles.slide, { [styles.isHidden]: i !== index })}
                            data-testid={i === index ? `${testId}-slide` : null}
                            key={item.key}
                            role="group"
                        >
                            <h3 className={styles.title}>{item.title}</h3>
                            <p className={styles.description}>{item.description}</p>
                            {item.image && (
                                <div className={styles.imageFrame}>
                                    <img alt={item.imageAlt || ''} className={styles.image} src={item.image} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <button
                    aria-disabled={isLast}
                    aria-label={intl.formatMessage(messages.next)}
                    className={styles.pagerButton}
                    data-testid={`${testId}-next`}
                    type="button"
                    onClick={isLast ? null : handleNext}
                >
                    <img alt="" className={styles.pagerIcon} draggable={false} src={nextIcon} />
                </button>
            </div>
            <div className={styles.footer}>
                <div aria-hidden="true" className={styles.dots} data-testid={`${testId}-dots`}>
                    {slides.map((item, i) => (
                        <span
                            className={classNames(styles.dot, { [styles.isCurrent]: i === index })}
                            key={item.key}
                        />
                    ))}
                </div>
                {!reducedMotion && total > 1 && (
                    <button
                        className={styles.pauseButton}
                        data-testid={`${testId}-pause`}
                        type="button"
                        onClick={handlePauseToggle}
                    >
                        <svg aria-hidden="true" className={styles.pauseIcon} viewBox="0 0 10 10">
                            {paused ? (
                                <path d="M2 1l7 4-7 4z" fill="currentColor" />
                            ) : (
                                <path d="M2 1h2v8H2zM6 1h2v8H6z" fill="currentColor" />
                            )}
                        </svg>
                        {intl.formatMessage(paused ? messages.play : messages.pause)}
                    </button>
                )}
            </div>
        </section>
    );
};

Carousel.propTypes = {
    className: PropTypes.string,
    interval: PropTypes.number,
    label: PropTypes.string.isRequired,
    slides: PropTypes.arrayOf(
        PropTypes.shape({
            description: PropTypes.node.isRequired,
            image: PropTypes.string,
            imageAlt: PropTypes.string,
            key: PropTypes.string.isRequired,
            title: PropTypes.node.isRequired,
        }),
    ).isRequired,
    testId: PropTypes.string,
};

export default Carousel;
