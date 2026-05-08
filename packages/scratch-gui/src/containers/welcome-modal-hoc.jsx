import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import WelcomeModal from '../components/welcome-modal/welcome-modal.jsx';
import { getUrlParams } from '../lib/url-params.js';
import { openTipsLibrary } from '../reducers/modals.js';

const STORAGE_KEY = 'smalruby:welcomeSeen';

const readSeen = () => {
    try {
        return (
            typeof window !== 'undefined' &&
            window.localStorage &&
            window.localStorage.getItem(STORAGE_KEY) === 'true'
        );
    } catch {
        return false;
    }
};

const writeSeen = () => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(STORAGE_KEY, 'true');
        }
    } catch {
        // ignore quota / privacy mode errors
    }
};

const shouldSuppressOnLoad = () => {
    if (readSeen()) return true;
    const params = getUrlParams();
    if (params.classcode) return true;
    if (typeof window !== 'undefined') {
        const search = new URLSearchParams(window.location.search);
        if (search.get('welcome') === 'skip') return true;
    }
    return false;
};

class WelcomeModalContainer extends React.Component {
    constructor(props) {
        super(props);
        this.state = { visible: !shouldSuppressOnLoad() };
        this.handleStartTutorial = this.handleStartTutorial.bind(this);
        this.handleLearnMore = this.handleLearnMore.bind(this);
        this.handleLater = this.handleLater.bind(this);
    }
    handleStartTutorial() {
        writeSeen();
        this.setState({ visible: false });
        this.props.onOpenTipsLibrary();
    }
    handleLearnMore() {
        if (typeof window !== 'undefined') {
            window.open('about.html', '_blank', 'noopener,noreferrer');
        }
    }
    handleLater() {
        writeSeen();
        this.setState({ visible: false });
    }
    render() {
        if (!this.state.visible) return null;
        return (
            <WelcomeModal
                onLater={this.handleLater}
                onLearnMore={this.handleLearnMore}
                onStartTutorial={this.handleStartTutorial}
            />
        );
    }
}

WelcomeModalContainer.propTypes = {
    onOpenTipsLibrary: PropTypes.func.isRequired,
};

const mapDispatchToProps = (dispatch) => ({
    onOpenTipsLibrary: () => dispatch(openTipsLibrary()),
});

export default connect(null, mapDispatchToProps)(WelcomeModalContainer);
