import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import React from 'react';

import {
    activateDeck,
    closeCards,
    shrinkExpandCards,
    nextStep,
    prevStep,
    dragCard,
    startDrag,
    endDrag
} from '../reducers/cards';

import {
    openTipsLibrary
} from '../reducers/modals';

import {
    activateTab,
    RUBY_TAB_INDEX
} from '../reducers/editor-tab';

import {
    updateRubyCode
} from '../reducers/ruby-code';

import CardsComponent from '../components/cards/cards.jsx';
import {loadImageData} from '../lib/libraries/decks/translate-image.js';
import {PLATFORM} from '../lib/platform.js';

const ANIMATION_DELAY_MS = 3000;

class Cards extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            animateNext: false,
            animateInsertCode: false,
            navigatedForward: true
        };
        this._animationTimers = [];
        this._handleNextStep = this._handleNextStep.bind(this);
        this._handlePrevStep = this._handlePrevStep.bind(this);
        this._handleInsertCodeFactory = this._handleInsertCodeFactory.bind(this);
    }

    componentDidMount () {
        if (this.props.locale !== 'en') {
            loadImageData(this.props.locale, this.props.platform);
        }
        this._scheduleAnimation();
    }

    componentDidUpdate (prevProps) {
        if (this.props.locale !== prevProps.locale) {
            loadImageData(this.props.locale, this.props.platform);
        }

        const stepChanged = this.props.step !== prevProps.step;
        const deckActivated = this.props.activeDeckId !== null &&
            this.props.activeDeckId !== prevProps.activeDeckId;

        if ((stepChanged || deckActivated) && this.state.navigatedForward) {
            this._clearAnimationTimers();
            this.setState({
                animateNext: false,
                animateInsertCode: false
            });
            this._scheduleAnimation();
        }
    }

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

        const timer = setTimeout(() => {
            if (target === 'nextButton') {
                this.setState({animateNext: true});
            } else if (target === 'insertCodeButton') {
                this.setState({animateInsertCode: true});
            }
        }, ANIMATION_DELAY_MS);
        this._animationTimers.push(timer);
    }

    _handleNextStep () {
        this.setState({
            navigatedForward: true,
            animateNext: false,
            animateInsertCode: false
        });
        this._clearAnimationTimers();
        this.props.onNextStepDispatch();
    }

    _handlePrevStep () {
        this.setState({
            navigatedForward: false,
            animateNext: false,
            animateInsertCode: false
        });
        this._clearAnimationTimers();
        this.props.onPrevStepDispatch();
    }

    _handleInsertCodeFactory (code) {
        return () => {
            // Stop insertCode animation and schedule nextButton animation
            this._clearAnimationTimers();
            this.setState({animateInsertCode: false});
            const timer = setTimeout(() => {
                this.setState({animateNext: true});
            }, ANIMATION_DELAY_MS);
            this._animationTimers.push(timer);

            this.props.onInsertCodeDispatch(code);
        };
    }

    render () {
        const props = {
            ...this.props,
            // Assume user is offline and don't attempt to
            // download and show videos
            showVideos: this.props.platform !== PLATFORM.DESKTOP &&
                this.props.platform !== PLATFORM.ANDROID,
            animateNext: this.state.animateNext,
            animateInsertCode: this.state.animateInsertCode,
            onNextStep: this._handleNextStep,
            onPrevStep: this._handlePrevStep,
            onInsertCodeFactory: this._handleInsertCodeFactory
        };
        return (
            <CardsComponent {...props} />
        );
    }
}

Cards.propTypes = {
    activeDeckId: PropTypes.string,
    content: PropTypes.object.isRequired,
    locale: PropTypes.string.isRequired,
    onInsertCodeDispatch: PropTypes.func.isRequired,
    onNextStepDispatch: PropTypes.func.isRequired,
    onPrevStepDispatch: PropTypes.func.isRequired,
    platform: PropTypes.oneOf(Object.keys(PLATFORM)),
    step: PropTypes.number.isRequired
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
    platform: state.scratchGui.platform.platform
});

const mapDispatchToProps = dispatch => ({
    onActivateDeckFactory: id => () => dispatch(activateDeck(id)),
    onShowAll: () => {
        dispatch(openTipsLibrary());
        dispatch(closeCards());
    },
    onCloseCards: () => dispatch(closeCards()),
    onShrinkExpandCards: () => dispatch(shrinkExpandCards()),
    onNextStepDispatch: () => dispatch(nextStep()),
    onPrevStepDispatch: () => dispatch(prevStep()),
    onDrag: (e_, data) => dispatch(dragCard(data.x, data.y)),
    onStartDrag: () => dispatch(startDrag()),
    onEndDrag: () => dispatch(endDrag()),
    onInsertCodeDispatch: code => {
        dispatch(activateTab(RUBY_TAB_INDEX));
        dispatch(updateRubyCode(code));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Cards);
