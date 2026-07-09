import PropTypes from 'prop-types';
import React, {Fragment} from 'react';
import classNames from 'classnames';
import {FormattedMessage} from 'react-intl';
import Draggable from 'react-draggable';

import styles from './card.css';

import shrinkIcon from './icon--shrink.svg';
import expandIcon from './icon--expand.svg';

import rightArrow from './icon--next.svg';
import leftArrow from './icon--prev.svg';

import helpIcon from '../../lib/assets/icon--tutorials.svg';
import closeIcon from './icon--close.svg';
import codeIcon from './icon--code.svg';
// === Smalruby: Start of start-tutorial button ===
import startIcon from './icon--start.svg';
// === Smalruby: End of start-tutorial button ===

import {translateVideo} from '../../lib/libraries/decks/translate-video.js';
import {translateImage} from '../../lib/libraries/decks/translate-image.js';

const CardHeader = ({onCloseCards, onShrinkExpandCards, onShowAll, totalSteps, step, expanded}) => (
    <div className={expanded ? styles.headerButtons : classNames(styles.headerButtons, styles.headerButtonsHidden)}>
        <div
            className={styles.allButton}
            onClick={onShowAll}
        >
            <img
                className={styles.helpIcon}
                src={helpIcon}
            />
            <FormattedMessage
                defaultMessage="Tutorials"
                description="Title for button to return to tutorials library"
                id="gui.cards.all-tutorials"
            />
        </div>
        {totalSteps > 1 ? (
            <div className={styles.stepsList}>
                {Array(totalSteps).fill(0)
                    .map((_, i) => (
                        <div
                            className={i === step ? styles.activeStepPip : styles.inactiveStepPip}
                            key={`pip-step-${i}`}
                        />
                    ))}
            </div>
        ) : null}
        <div className={styles.headerButtonsRight}>
            <div
                className={styles.shrinkExpandButton}
                onClick={onShrinkExpandCards}
            >
                <img
                    draggable={false}
                    src={expanded ? shrinkIcon : expandIcon}
                />
                {expanded ?
                    <FormattedMessage
                        defaultMessage="Shrink"
                        description="Title for button to shrink how-to card"
                        id="gui.cards.shrink"
                    /> :
                    <FormattedMessage
                        defaultMessage="Expand"
                        description="Title for button to expand how-to card"
                        id="gui.cards.expand"
                    />
                }
            </div>
            <div
                className={styles.removeButton}
                onClick={onCloseCards}
            >
                <img
                    className={styles.closeIcon}
                    src={closeIcon}
                />
                <FormattedMessage
                    defaultMessage="Close"
                    description="Title for button to close how-to card"
                    id="gui.cards.close"
                />
            </div>
        </div>
    </div>
);

class VideoStep extends React.Component {

    componentDidMount () {
        const script = document.createElement('script');
        script.src = `https://fast.wistia.com/embed/medias/${this.props.video}.jsonp`;
        script.async = true;
        script.setAttribute('id', 'wistia-video-content');
        document.body.appendChild(script);

        const script2 = document.createElement('script');
        script2.src = 'https://fast.wistia.com/assets/external/E-v1.js';
        script2.async = true;
        script2.setAttribute('id', 'wistia-video-api');
        document.body.appendChild(script2);
    }

    // We use the Wistia API here to update or pause the video dynamically:
    // https://wistia.com/support/developers/player-api
    componentDidUpdate (prevProps) {
        // Ensure the wistia API is loaded and available
        if (!(window.Wistia && window.Wistia.api)) return;

        // Get a handle on the currently loaded video
        const video = window.Wistia.api(prevProps.video);

        // Reset the video source if a new video has been chosen from the library
        if (prevProps.video !== this.props.video) {
            video.replaceWith(this.props.video);
        }

        // Pause the video if the modal is being shrunken
        if (!this.props.expanded) {
            video.pause();
        }
    }

    componentWillUnmount () {
        const script = document.getElementById('wistia-video-content');
        if (script) script.parentNode.removeChild(script);

        const script2 = document.getElementById('wistia-video-api');
        if (script2) script2.parentNode.removeChild(script2);
    }

    render () {
        return (
            <div className={styles.stepVideo}>
                <div
                    className={`wistia_embed wistia_async_${this.props.video}`}
                    id="video-div"
                    style={{height: `257px`, width: `466px`}}
                >
                    &nbsp;
                </div>
            </div>
        );
    }
}

VideoStep.propTypes = {
    expanded: PropTypes.bool.isRequired,
    video: PropTypes.string.isRequired
};

// === Smalruby: Start of tutorial glow animation (insert-code button overlay) ===
// === Smalruby: Start of start-tutorial button ===
const ImageStep = ({
    title, image, code, codeType, onInsertCodeFactory, animateInsertCode,
    startTutorial, onStartTutorial, animateStartTutorial,
    // === Smalruby: Start of external-url button ===
    externalUrl, externalUrlLabel
    // === Smalruby: End of external-url button ===
}) => (<Fragment>
    <div className={styles.stepTitle}>
        {title}
    </div>
    <div className={styles.stepImageContainer}>
        <img
            className={styles.stepImage}
            draggable={false}
            key={image} /* Use src as key to prevent hanging around on slow connections */
            src={image}
        />
        {startTutorial && onStartTutorial ? (
            <button
                className={animateStartTutorial ?
                    classNames(styles.insertCodeButton, styles.insertCodeButtonOverlay, styles.insertCodeButtonGlow) :
                    classNames(styles.insertCodeButton, styles.insertCodeButtonOverlay)}
                data-card-action="start-tutorial"
                onClick={onStartTutorial}
            >
                <img
                    className={styles.codeIcon}
                    src={startIcon}
                />
                <FormattedMessage
                    defaultMessage="Start Tutorial"
                    description="Button to reset project and start tutorial"
                    id="gui.cards.start-tutorial"
                />
            </button>
        ) : null}
        {code && onInsertCodeFactory ? (
            <button
                className={animateInsertCode ?
                    classNames(styles.insertCodeButton, styles.insertCodeButtonOverlay, styles.insertCodeButtonGlow) :
                    classNames(styles.insertCodeButton, styles.insertCodeButtonOverlay)}
                data-card-action={codeType === 'blocks' ? 'insert-blocks' : 'insert-ruby'}
                onClick={onInsertCodeFactory(code, codeType)}
            >
                <img
                    className={styles.codeIcon}
                    src={codeIcon}
                />
                {codeType === 'blocks' ? (
                    <FormattedMessage
                        defaultMessage="Insert Blocks"
                        description="Button to insert code as blocks (injects Ruby then switches to blocks tab)"
                        id="gui.cards.insert-blocks"
                    />
                ) : (
                    <FormattedMessage
                        defaultMessage="Insert This Ruby"
                        description="Button to insert code into Ruby tab"
                        id="gui.cards.insert-ruby"
                    />
                )}
            </button>
        ) : null}
        {/* === Smalruby: Start of external-url button === */}
        {externalUrl ? (
            <a
                className={classNames(styles.insertCodeButton, styles.insertCodeButtonOverlay)}
                data-card-action="open-external-link"
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
            >
                {externalUrlLabel || (
                    <FormattedMessage
                        defaultMessage="Open External Link"
                        description="Button to open an external website in a new browser tab"
                        id="gui.cards.open-external-link"
                    />
                )}
            </a>
        ) : null}
        {/* === Smalruby: End of external-url button === */}
    </div>
</Fragment>
);

ImageStep.propTypes = {
    animateInsertCode: PropTypes.bool, // Smalruby: tutorial glow animation
    animateStartTutorial: PropTypes.bool, // Smalruby: start-tutorial button glow
    code: PropTypes.string,
    codeType: PropTypes.string, // 'ruby' (default) or 'blocks'
    // === Smalruby: Start of external-url button ===
    externalUrl: PropTypes.string, // Smalruby: opens this URL in a new tab (e.g. TryRuby)
    externalUrlLabel: PropTypes.node, // Smalruby: optional custom label for the external link button
    // === Smalruby: End of external-url button ===
    image: PropTypes.string.isRequired,
    onInsertCodeFactory: PropTypes.func,
    onStartTutorial: PropTypes.func, // Smalruby: start-tutorial button handler
    startTutorial: PropTypes.bool, // Smalruby: show start-tutorial button
    title: PropTypes.node.isRequired
};
// === Smalruby: End of start-tutorial button ===
// === Smalruby: End of tutorial glow animation (insert-code button overlay) ===

// === Smalruby: Start of tutorial glow animation (next button) ===
const NextPrevButtons = ({isRtl, onNextStep, onPrevStep, expanded, animateNext}) => (
    <Fragment>
        {onNextStep ? (
            <div>
                <div className={expanded ? (isRtl ? styles.leftCard : styles.rightCard) : styles.hidden} />
                <div
                    className={expanded ? (
                        isRtl ?
                            (animateNext ? classNames(styles.leftButton, styles.leftButtonGlow) : styles.leftButton) :
                            (animateNext ? classNames(styles.rightButton, styles.rightButtonGlow) : styles.rightButton)
                    ) : styles.hidden}
                    data-card-action="next"
                    onClick={onNextStep}
                >
                    <img
                        draggable={false}
                        src={isRtl ? leftArrow : rightArrow}
                    />
                </div>
            </div>
        ) : null}
        {onPrevStep ? (
            <div>
                <div className={expanded ? (isRtl ? styles.rightCard : styles.leftCard) : styles.hidden} />
                <div
                    className={expanded ? (isRtl ? styles.rightButton : styles.leftButton) : styles.hidden}
                    data-card-action="prev"
                    onClick={onPrevStep}
                >
                    <img
                        draggable={false}
                        src={isRtl ? rightArrow : leftArrow}
                    />
                </div>
            </div>
        ) : null}
    </Fragment>
);

NextPrevButtons.propTypes = {
    animateNext: PropTypes.bool, // Smalruby: tutorial glow animation
    expanded: PropTypes.bool.isRequired,
    isRtl: PropTypes.bool,
    onNextStep: PropTypes.func,
    onPrevStep: PropTypes.func
};
// === Smalruby: End of tutorial glow animation (next button) ===
CardHeader.propTypes = {
    expanded: PropTypes.bool.isRequired,
    onCloseCards: PropTypes.func.isRequired,
    onShowAll: PropTypes.func.isRequired,
    onShrinkExpandCards: PropTypes.func.isRequired,
    step: PropTypes.number,
    totalSteps: PropTypes.number
};

const PreviewsStep = ({deckIds, content, onActivateDeckFactory, onShowAll}) => (
    <Fragment>
        <div className={styles.stepTitle}>
            <FormattedMessage
                defaultMessage="More things to try!"
                description="Title card with more things to try"
                id="gui.cards.more-things-to-try"
            />
        </div>
        <div className={styles.decks}>
            {deckIds.slice(0, 2).map(id => (
                <div
                    className={styles.deck}
                    key={`deck-preview-${id}`}
                    onClick={id in content ? onActivateDeckFactory(id) : null}
                >
                    <img
                        className={styles.deckImage}
                        draggable={false}
                        src={content[id]?.img}
                    />
                    <div className={styles.deckName}>{content[id]?.name}</div>
                </div>
            ))}
        </div>
        <div className={styles.seeAll}>
            <div
                className={styles.seeAllButton}
                onClick={onShowAll}
            >
                <FormattedMessage
                    defaultMessage="See more"
                    description="Title for button to see more in how-to library"
                    id="gui.cards.see-more"
                />
            </div>
        </div>
    </Fragment>
);

PreviewsStep.propTypes = {
    content: PropTypes.shape({
        id: PropTypes.shape({
            name: PropTypes.node.isRequired,
            img: PropTypes.string.isRequired,
            steps: PropTypes.arrayOf(PropTypes.shape({
                title: PropTypes.node,
                image: PropTypes.string,
                video: PropTypes.string,
                deckIds: PropTypes.arrayOf(PropTypes.string)
            }))
        })
    }).isRequired,
    deckIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    onActivateDeckFactory: PropTypes.func.isRequired,
    onShowAll: PropTypes.func.isRequired
};

const PreviewExternalStep = ({externalResources, onShowAll}) => (
    <Fragment>
        <div className={styles.stepTitle}>
            <FormattedMessage
                defaultMessage="More things to try!"
                description="Title card with more things to try"
                id="gui.cards.more-things-to-try"
            />
        </div>
        <div className={styles.resources}>
            {Object.keys(externalResources).slice(0, 2)
                .map(id => (
                    <a
                        className={styles.resource}
                        key={`resource-preview-${id}`}
                        href={externalResources[id].url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <img
                            className={styles.resourceImage}
                            draggable={false}
                            src={externalResources[id].img}
                        />
                        <div className={styles.resourceName}>{externalResources[id].name}</div>
                    </a>
                ))}
        </div>
        <div className={styles.seeAll}>
            <div
                className={styles.seeAllButton}
                onClick={onShowAll}
            >
                <FormattedMessage
                    defaultMessage="See more"
                    description="Title for button to see more in how-to library"
                    id="gui.cards.see-more"
                />
            </div>
        </div>
    </Fragment>
);

PreviewExternalStep.propTypes = {
    externalResources: PropTypes.shape({
        id: PropTypes.shape({
            name: PropTypes.node.isRequired,
            img: PropTypes.string.isRequired,
            url: PropTypes.string.isRequired
        })
    }).isRequired,
    onShowAll: PropTypes.func.isRequired
};

const Cards = props => {
    const {
        activeDeckId,
        content,
        dragging,
        isRtl,
        locale,
        onActivateDeckFactory,
        onCloseCards,
        onShrinkExpandCards,
        onDrag,
        onStartDrag,
        onEndDrag,
        onInsertCodeFactory,
        onShowAll,
        onNextStep,
        onPrevStep,
        step,
        expanded,
        showVideos,
        // === Smalruby: Start of tutorial glow animation ===
        animateNext,
        animateInsertCode,
        // === Smalruby: End of tutorial glow animation ===
        // === Smalruby: Start of start-tutorial button ===
        animateStartTutorial,
        onStartTutorial,
        // === Smalruby: End of start-tutorial button ===
        ...posProps
    } = props;
    let {x, y} = posProps;

    if (activeDeckId === null) return null;

    // Tutorial cards need to calculate their own dragging bounds
    // to allow for dragging the cards off the left, right and bottom
    // edges of the workspace.
    const cardHorizontalDragOffset = 400; // ~80% of card width
    const cardVerticalDragOffset = expanded ? 257 : 0; // ~80% of card height, if expanded
    const menuBarHeight = 48; // TODO: get pre-calculated from elsewhere?
    const wideCardWidth = 500;

    if (x === 0 && y === 0) {
        // initialize positions
        x = isRtl ? (-190 - wideCardWidth - cardHorizontalDragOffset) : 292;
        x += cardHorizontalDragOffset;
        // The tallest cards are about 500px high (header ~40 + title ~40 + image 360 + margins ~60),
        // and the default position is pinned to near the bottom of the blocks palette to allow room to work above.
        const tallCardHeight = 500;
        const bottomMargin = 60; // To avoid overlapping the backpack region
        y = window.innerHeight - tallCardHeight - bottomMargin - menuBarHeight;
    }

    const steps = content[activeDeckId].steps;

    return (
        // Custom overlay to act as the bounding parent for the draggable, using values from above
        <div
            className={styles.cardContainerOverlay}
            style={{
                width: `${window.innerWidth + (2 * cardHorizontalDragOffset)}px`,
                height: `${window.innerHeight - menuBarHeight + cardVerticalDragOffset}px`,
                top: `${menuBarHeight}px`,
                left: `${-cardHorizontalDragOffset}px`
            }}
        >
            <Draggable
                bounds="parent"
                cancel="#video-div" // disable dragging on video div
                position={{x: x, y: y}}
                onDrag={onDrag}
                onStart={onStartDrag}
                onStop={onEndDrag}
            >
                <div className={styles.cardContainer}>
                    <div
                        className={styles.card}
                        data-deck-id={activeDeckId}
                        data-step={step + 1}
                        data-total-steps={steps.length}
                        data-steps-remaining={steps.length - step - 1}
                    >
                        <CardHeader
                            expanded={expanded}
                            step={step}
                            totalSteps={steps.length}
                            onCloseCards={onCloseCards}
                            onShowAll={onShowAll}
                            onShrinkExpandCards={onShrinkExpandCards}
                        />
                        <div className={expanded ? styles.stepBody : styles.hidden}>
                            {steps[step].deckIds ? (
                                <PreviewsStep
                                    content={content}
                                    deckIds={steps[step].deckIds}
                                    onActivateDeckFactory={onActivateDeckFactory}
                                    onShowAll={onShowAll}
                                />
                            ) : (
                                steps[step].externalResources ? (
                                    <PreviewExternalStep
                                        externalResources={steps[step].externalResources}
                                        onShowAll={onShowAll}
                                    />
                                ) :
                                    steps[step].video ? (
                                        showVideos ?
                                            (
                                                <VideoStep
                                                    dragging={dragging}
                                                    expanded={expanded}
                                                    video={translateVideo(steps[step].video, locale)}
                                                />
                                            ) : (
                                                <ImageStep
                                                    image={content[activeDeckId].img}
                                                    title={content[activeDeckId].name}
                                                />
                                            )
                                    ) : (
                                        <ImageStep
                                            animateInsertCode={animateInsertCode}
                                            animateStartTutorial={animateStartTutorial}
                                            code={steps[step].code}
                                            codeType={steps[step].codeType}
                                            // === Smalruby: Start of external-url button ===
                                            externalUrl={steps[step].externalUrl}
                                            externalUrlLabel={steps[step].externalUrlLabel}
                                            // === Smalruby: End of external-url button ===
                                            image={translateImage(steps[step].image, locale)}
                                            onInsertCodeFactory={onInsertCodeFactory}
                                            onStartTutorial={steps[step].startTutorial ? onStartTutorial : null}
                                            startTutorial={steps[step].startTutorial}
                                            title={steps[step].title}
                                        />
                                    )
                            )}
                            {steps[step].trackingPixel && steps[step].trackingPixel}
                        </div>
                        <NextPrevButtons
                            animateNext={animateNext}
                            expanded={expanded}
                            isRtl={isRtl}
                            onNextStep={step < steps.length - 1 ? onNextStep : null}
                            onPrevStep={step > 0 ? onPrevStep : null}
                        />
                    </div>
                </div>
            </Draggable>
        </div>
    );
};

Cards.propTypes = {
    activeDeckId: PropTypes.string,
    // === Smalruby: Start of tutorial glow animation ===
    animateInsertCode: PropTypes.bool,
    animateNext: PropTypes.bool,
    // === Smalruby: End of tutorial glow animation ===
    // === Smalruby: Start of start-tutorial button ===
    animateStartTutorial: PropTypes.bool,
    // === Smalruby: End of start-tutorial button ===
    content: PropTypes.shape({
        id: PropTypes.shape({
            name: PropTypes.node.isRequired,
            img: PropTypes.string.isRequired,
            steps: PropTypes.arrayOf(PropTypes.shape({
                title: PropTypes.node,
                image: PropTypes.string,
                video: PropTypes.string,
                code: PropTypes.string,
                codeType: PropTypes.string,
                // === Smalruby: Start of external-url button ===
                externalUrl: PropTypes.string,
                externalUrlLabel: PropTypes.node,
                // === Smalruby: End of external-url button ===
                deckIds: PropTypes.arrayOf(PropTypes.string)
            }))
        })
    }),
    dragging: PropTypes.bool.isRequired,
    expanded: PropTypes.bool.isRequired,
    isRtl: PropTypes.bool.isRequired,
    locale: PropTypes.string.isRequired,
    onActivateDeckFactory: PropTypes.func.isRequired,
    onCloseCards: PropTypes.func.isRequired,
    onDrag: PropTypes.func,
    onEndDrag: PropTypes.func,
    onInsertCodeFactory: PropTypes.func,
    onNextStep: PropTypes.func.isRequired,
    onPrevStep: PropTypes.func.isRequired,
    // === Smalruby: Start of start-tutorial button ===
    onStartTutorial: PropTypes.func,
    // === Smalruby: End of start-tutorial button ===
    onShowAll: PropTypes.func,
    onShrinkExpandCards: PropTypes.func.isRequired,
    onStartDrag: PropTypes.func,
    showVideos: PropTypes.bool,
    step: PropTypes.number.isRequired,
    x: PropTypes.number,
    y: PropTypes.number
};

export {
    Cards as default,
    // Others exported for testability
    ImageStep,
    VideoStep
};
