import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import React from 'react';
// === Smalruby: Start of start-tutorial button ===
import {useIntl} from 'react-intl';
// === Smalruby: End of start-tutorial button ===

import {
    activateDeck,
    closeCards,
    shrinkExpandCards,
    nextStep,
    prevStep,
    dragCard,
    startDrag,
    endDrag,
    // === Smalruby: Start of start-tutorial button ===
    setPendingProjectTitle
    // === Smalruby: End of start-tutorial button ===
} from '../reducers/cards';

import {
    openTipsLibrary
} from '../reducers/modals';

import {
    activateTab,
    BLOCKS_TAB_INDEX,
    RUBY_TAB_INDEX
} from '../reducers/editor-tab';

import {
    updateRubyCode
} from '../reducers/ruby-code';

// === Smalruby: Start of start-tutorial button ===
import {
    requestNewProject
} from '../reducers/project-state';

import sharedMessages from '../lib/shared-messages';
// === Smalruby: End of start-tutorial button ===

import CardsComponent from '../components/cards/cards.jsx';
import {loadImageData} from '../lib/libraries/decks/translate-image.js';
import {PLATFORM} from '../lib/platform.js';

// === Smalruby: Start of tutorial glow animation ===
const ANIMATION_DELAY_MS = 3000;
const INSERT_CODE_ANIMATION_DELAY_MS = 300; // Shorter delay so users notice the button quickly
// === Smalruby: End of tutorial glow animation ===

class Cards extends React.Component {
    // === Smalruby: Start of tutorial glow animation ===
    constructor (props) {
        super(props);
        this.state = {
            animateNext: false,
            animateInsertCode: false,
            // === Smalruby: Start of start-tutorial button ===
            animateStartTutorial: false,
            // === Smalruby: End of start-tutorial button ===
            navigatedForward: true
        };
        this._animationTimers = [];
        this._handleNextStep = this._handleNextStep.bind(this);
        this._handlePrevStep = this._handlePrevStep.bind(this);
        this._handleInsertCodeFactory = this._handleInsertCodeFactory.bind(this);
        // === Smalruby: Start of start-tutorial button ===
        this._handleStartTutorial = this._handleStartTutorial.bind(this);
        // === Smalruby: End of start-tutorial button ===
    }
    // === Smalruby: End of tutorial glow animation ===

    componentDidMount () {
        if (this.props.locale !== 'en') {
            loadImageData(this.props.locale, this.props.platform);
        }
        // === Smalruby: Start of tutorial glow animation ===
        this._scheduleAnimation();
        // === Smalruby: End of tutorial glow animation ===
    }

    componentDidUpdate (prevProps) {
        if (this.props.locale !== prevProps.locale) {
            loadImageData(this.props.locale, this.props.platform);
        }
        // === Smalruby: Start of tutorial glow animation ===
        const stepChanged = this.props.step !== prevProps.step;
        const deckActivated = this.props.activeDeckId !== null &&
            this.props.activeDeckId !== prevProps.activeDeckId;

        if ((stepChanged || deckActivated) && this.state.navigatedForward) {
            this._clearAnimationTimers();
            this.setState({
                animateNext: false,
                animateInsertCode: false,
                // === Smalruby: Start of start-tutorial button ===
                animateStartTutorial: false
                // === Smalruby: End of start-tutorial button ===
            });
            this._scheduleAnimation();
        }
        // === Smalruby: End of tutorial glow animation ===
    }

    // === Smalruby: Start of tutorial glow animation ===
    componentWillUnmount () {
        this._clearAnimationTimers();
    }

    _clearAnimationTimers () {
        this._animationTimers.forEach(t => clearTimeout(t));
        this._animationTimers = [];
    }

    _scheduleAnimation () {
        if (!this.props.activeDeckId) return;
        const steps = this.props.content[this.props.activeDeckId] &&
            this.props.content[this.props.activeDeckId].steps;
        if (!steps) return;
        const currentStep = steps[this.props.step];
        if (!currentStep) return;
        const target = currentStep.animationTarget;
        if (!target) return;

        // === Smalruby: Start of start-tutorial button ===
        const shortDelayTargets = ['insertCodeButton', 'startTutorialButton'];
        const delay = shortDelayTargets.includes(target) ? INSERT_CODE_ANIMATION_DELAY_MS : ANIMATION_DELAY_MS;
        // === Smalruby: End of start-tutorial button ===
        const timer = setTimeout(() => {
            if (target === 'nextButton') {
                this.setState({animateNext: true});
            } else if (target === 'insertCodeButton') {
                this.setState({animateInsertCode: true});
            // === Smalruby: Start of start-tutorial button ===
            } else if (target === 'startTutorialButton') {
                this.setState({animateStartTutorial: true});
            // === Smalruby: End of start-tutorial button ===
            }
        }, delay);
        this._animationTimers.push(timer);
    }

    _handleNextStep () {
        this.setState({
            navigatedForward: true,
            animateNext: false,
            animateInsertCode: false,
            // === Smalruby: Start of start-tutorial button ===
            animateStartTutorial: false
            // === Smalruby: End of start-tutorial button ===
        });
        this._clearAnimationTimers();
        this.props.onNextStepDispatch();
    }

    _handlePrevStep () {
        this.setState({
            navigatedForward: false,
            animateNext: false,
            animateInsertCode: false,
            // === Smalruby: Start of start-tutorial button ===
            animateStartTutorial: false
            // === Smalruby: End of start-tutorial button ===
        });
        this._clearAnimationTimers();
        this.props.onPrevStepDispatch();
    }

    // === Smalruby: Start of start-tutorial button ===
    _handleStartTutorial () {
        // Show confirm dialog if project has been changed
        if (this.props.projectChanged) {
            const message = this.props.intl.formatMessage(sharedMessages.replaceProjectWarning);
            if (!confirm(message)) { // eslint-disable-line no-alert
                return;
            }
        }

        // Reset project and set title to tutorial name
        const deck = this.props.content[this.props.activeDeckId];
        const deckName = (deck && deck.nameMessageId) ?
            this.props.intl.formatMessage({id: deck.nameMessageId}) :
            '';
        this.props.onStartTutorialDispatch(deckName);

        // Stop animation and schedule nextButton glow
        this._clearAnimationTimers();
        this.setState({animateStartTutorial: false});
        const timer = setTimeout(() => {
            this.setState({animateNext: true});
        }, ANIMATION_DELAY_MS);
        this._animationTimers.push(timer);
    }
    // === Smalruby: End of start-tutorial button ===

    _handleInsertCodeFactory (code, codeType) {
        return () => {
            // Stop insertCode animation and schedule nextButton animation
            this._clearAnimationTimers();
            this.setState({animateInsertCode: false});
            const timer = setTimeout(() => {
                this.setState({animateNext: true});
            }, ANIMATION_DELAY_MS);
            this._animationTimers.push(timer);

            this.props.onInsertCodeDispatch(code, codeType);
        };
    }
    // === Smalruby: End of tutorial glow animation ===

    render () {
        const props = {
            ...this.props,
            // Assume user is offline and don't attempt to
            // download and show videos
            showVideos: this.props.platform !== PLATFORM.DESKTOP &&
                this.props.platform !== PLATFORM.ANDROID,
            // === Smalruby: Start of tutorial glow animation ===
            animateNext: this.state.animateNext,
            animateInsertCode: this.state.animateInsertCode,
            // === Smalruby: Start of start-tutorial button ===
            animateStartTutorial: this.state.animateStartTutorial,
            // === Smalruby: End of start-tutorial button ===
            onNextStep: this._handleNextStep,
            onPrevStep: this._handlePrevStep,
            onInsertCodeFactory: this._handleInsertCodeFactory,
            // === Smalruby: Start of start-tutorial button ===
            onStartTutorial: this._handleStartTutorial
            // === Smalruby: End of start-tutorial button ===
            // === Smalruby: End of tutorial glow animation ===
        };
        return (
            <CardsComponent {...props} />
        );
    }
}

Cards.propTypes = {
    // === Smalruby: Start of tutorial glow animation ===
    activeDeckId: PropTypes.string,
    content: PropTypes.object.isRequired,
    // === Smalruby: End of tutorial glow animation ===
    // === Smalruby: Start of start-tutorial button ===
    intl: PropTypes.shape({
        formatMessage: PropTypes.func.isRequired
    }).isRequired,
    // === Smalruby: End of start-tutorial button ===
    locale: PropTypes.string.isRequired,
    // === Smalruby: Start of tutorial glow animation ===
    onInsertCodeDispatch: PropTypes.func.isRequired,
    onNextStepDispatch: PropTypes.func.isRequired,
    onPrevStepDispatch: PropTypes.func.isRequired,
    // === Smalruby: End of tutorial glow animation ===
    // === Smalruby: Start of start-tutorial button ===
    onStartTutorialDispatch: PropTypes.func.isRequired,
    // === Smalruby: End of start-tutorial button ===
    platform: PropTypes.oneOf(Object.keys(PLATFORM)),
    // === Smalruby: Start of start-tutorial button ===
    projectChanged: PropTypes.bool,
    // === Smalruby: End of start-tutorial button ===
    // === Smalruby: Start of tutorial glow animation ===
    step: PropTypes.number.isRequired
    // === Smalruby: End of tutorial glow animation ===
};

const mapStateToProps = state => ({
    visible: state.scratchGui.cards.visible,
    content: state.scratchGui.cards.content,
    activeDeckId: state.scratchGui.cards.activeDeckId,
    step: state.scratchGui.cards.step,
    expanded: state.scratchGui.cards.expanded,
    x: state.scratchGui.cards.x,
    y: state.scratchGui.cards.y,
    isRtl: state.locales.isRtl,
    locale: state.locales.locale,
    dragging: state.scratchGui.cards.dragging,
    platform: state.scratchGui.platform.platform,
    // === Smalruby: Start of start-tutorial button ===
    projectChanged: state.scratchGui.projectChanged
    // === Smalruby: End of start-tutorial button ===
});

const mapDispatchToProps = dispatch => ({
    onActivateDeckFactory: id => () => dispatch(activateDeck(id)),
    onShowAll: () => {
        dispatch(openTipsLibrary());
        dispatch(closeCards());
    },
    onCloseCards: () => dispatch(closeCards()),
    onShrinkExpandCards: () => dispatch(shrinkExpandCards()),
    // === Smalruby: Start of tutorial glow animation ===
    // Renamed from onNextStep/onPrevStep to allow interception in render()
    onNextStepDispatch: () => dispatch(nextStep()),
    onPrevStepDispatch: () => dispatch(prevStep()),
    // === Smalruby: End of tutorial glow animation ===
    onDrag: (e_, data) => dispatch(dragCard(data.x, data.y)),
    onStartDrag: () => dispatch(startDrag()),
    onEndDrag: () => dispatch(endDrag()),
    // === Smalruby: Start of tutorial glow animation ===
    // Renamed from onInsertCodeFactory to allow interception in render()
    onInsertCodeDispatch: (code, codeType) => {
        dispatch(updateRubyCode(code));
        if (codeType === 'blocks') {
            // Inject Ruby silently then switch to blocks tab for block conversion
            dispatch(activateTab(BLOCKS_TAB_INDEX));
        } else {
            dispatch(activateTab(RUBY_TAB_INDEX));
        }
    },
    // === Smalruby: End of tutorial glow animation ===
    // === Smalruby: Start of start-tutorial button ===
    onStartTutorialDispatch: deckName => {
        dispatch(setPendingProjectTitle(deckName));
        dispatch(requestNewProject(false));
    }
    // === Smalruby: End of start-tutorial button ===
});

const ConnectedCards = connect(
    mapStateToProps,
    mapDispatchToProps
)(Cards);

// === Smalruby: Start of start-tutorial button ===
// Wrapper to provide useIntl() hook to class component
const CardsWithIntl = props => {
    const intl = useIntl();
    return (
        <ConnectedCards
            {...props}
            intl={intl}
        />
    );
};
// === Smalruby: End of start-tutorial button ===

export default CardsWithIntl;
