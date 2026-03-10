import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import {defineMessages, injectIntl} from 'react-intl';
import intlShape from './intlShape';

import {
    getIsAnyCreatingNewState,
    getIsShowingWithoutId
} from '../reducers/project-state';
import {setProjectTitle} from '../reducers/project-title';
// === Smalruby: Start of start-tutorial button ===
import {setPendingProjectTitle} from '../reducers/cards';
// === Smalruby: End of start-tutorial button ===

const messages = defineMessages({
    defaultProjectTitle: {
        id: 'gui.smalruby3.gui.defaultProjectTitle',
        description: 'Default title for project',
        defaultMessage: 'Smalruby Project'
    }
});

/* Higher Order Component to get and set the project title
 * @param {React.Component} WrappedComponent component to receive project title related props
 * @returns {React.Component} component with project loading behavior
 */
const TitledHOC = function (WrappedComponent) {
    class TitledComponent extends React.Component {
        componentDidMount () {
            this.handleReceivedProjectTitle(this.props.projectTitle);
        }
        componentDidUpdate (prevProps) {
            if (this.props.projectTitle !== prevProps.projectTitle) {
                this.handleReceivedProjectTitle(this.props.projectTitle);
            }
            // if project is a new default project, and has loaded,
            if (this.props.isShowingWithoutId && !this.props.isAnyCreatingNewState && prevProps.isAnyCreatingNewState) {
                // === Smalruby: Start of start-tutorial button ===
                // Use pending tutorial title if set, otherwise reset to default
                if (this.props.pendingProjectTitle) {
                    this.handleReceivedProjectTitle(this.props.pendingProjectTitle);
                    this.props.onClearPendingProjectTitle();
                } else {
                    // reset title to default
                    this.handleReceivedProjectTitle();
                }
                // === Smalruby: End of start-tutorial button ===
            }
            // if the projectTitle hasn't changed, but the reduxProjectTitle
            // HAS changed, we need to report that change to the projectTitle's owner
            if (!this.props.isShowingWithoutId &&
                !this.props.isAnyCreatingNewState &&
                this.props.reduxProjectTitle !== prevProps.reduxProjectTitle &&
                this.props.reduxProjectTitle !== this.props.projectTitle) {
                this.props.onUpdateProjectTitle(this.props.reduxProjectTitle);
            }
        }
        handleReceivedProjectTitle (requestedTitle) {
            let newTitle = requestedTitle;
            if (newTitle === null || typeof newTitle === 'undefined') {
                newTitle = this.props.intl.formatMessage(messages.defaultProjectTitle);
            }
            this.props.onChangedProjectTitle(newTitle);
            return newTitle;
        }
        render () {
            const {

                intl,
                isAnyCreatingNewState,
                isShowingWithoutId,
                onChangedProjectTitle,
                // === Smalruby: Start of start-tutorial button ===
                onClearPendingProjectTitle,
                pendingProjectTitle,
                // === Smalruby: End of start-tutorial button ===
                // for children, we replace onUpdateProjectTitle with our own
                onUpdateProjectTitle,
                // we don't pass projectTitle prop to children -- they must use
                // redux value
                projectTitle,
                reduxProjectTitle,

                ...componentProps
            } = this.props;
            return (
                <WrappedComponent
                    {...componentProps}
                />
            );
        }
    }

    TitledComponent.propTypes = {
        intl: intlShape,
        isAnyCreatingNewState: PropTypes.bool,
        isShowingWithoutId: PropTypes.bool,
        onChangedProjectTitle: PropTypes.func,
        // === Smalruby: Start of start-tutorial button ===
        onClearPendingProjectTitle: PropTypes.func,
        pendingProjectTitle: PropTypes.string,
        // === Smalruby: End of start-tutorial button ===
        onUpdateProjectTitle: PropTypes.func,
        projectTitle: PropTypes.string,
        reduxProjectTitle: PropTypes.string
    };

    TitledComponent.defaultProps = {
        onUpdateProjectTitle: () => {}
    };

    const mapStateToProps = state => {
        const loadingState = state.scratchGui.projectState.loadingState;
        return {
            isAnyCreatingNewState: getIsAnyCreatingNewState(loadingState),
            isShowingWithoutId: getIsShowingWithoutId(loadingState),
            reduxProjectTitle: state.scratchGui.projectTitle,
            // === Smalruby: Start of start-tutorial button ===
            pendingProjectTitle: state.scratchGui.cards.pendingProjectTitle
            // === Smalruby: End of start-tutorial button ===
        };
    };

    const mapDispatchToProps = dispatch => ({
        onChangedProjectTitle: title => dispatch(setProjectTitle(title)),
        // === Smalruby: Start of start-tutorial button ===
        onClearPendingProjectTitle: () => dispatch(setPendingProjectTitle(null))
        // === Smalruby: End of start-tutorial button ===
    });

    return injectIntl(connect(
        mapStateToProps,
        mapDispatchToProps
    )(TitledComponent));
};

export {
    TitledHOC as default
};
