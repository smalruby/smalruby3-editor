import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import React from 'react';

// === Smalruby: Start of help menu ===
// openLessonsLibrary belongs to the lessons button below (one import line
// because eslint forbids importing the same module twice).
import {openLessonsLibrary, openTipsLibrary} from '../reducers/modals';
// === Smalruby: End of help menu ===
// === Smalruby: Start of lessons button ===
import {markTutorialSeen} from '../reducers/tutorial-onboarding';
import {isLessonMode} from '../reducers/lesson-mode';
// === Smalruby: End of lessons button ===

const MenuBarHOC = function (WrappedComponent) {
    class MenuBarContainer extends React.PureComponent {
        constructor (props) {
            super(props);

            bindAll(this, [
                'confirmReadyToReplaceProject',
                'shouldSaveBeforeTransition'
            ]);
        }
        confirmReadyToReplaceProject (message) {
            let readyToReplaceProject = true;
            if (this.props.projectChanged && !this.props.canCreateNew) {
                readyToReplaceProject = this.props.confirmWithMessage(message);
            }
            return readyToReplaceProject;
        }
        shouldSaveBeforeTransition () {
            return (this.props.canSave && this.props.projectChanged);
        }
        render () {
            const {
                 
                projectChanged,
                 
                ...props
            } = this.props;
            return (<WrappedComponent
                confirmReadyToReplaceProject={this.confirmReadyToReplaceProject}
                shouldSaveBeforeTransition={this.shouldSaveBeforeTransition}
                {...props}
            />);
        }
    }

    MenuBarContainer.propTypes = {
        canCreateNew: PropTypes.bool,
        canSave: PropTypes.bool,
        confirmWithMessage: PropTypes.func,
        projectChanged: PropTypes.bool
    };
    MenuBarContainer.defaultProps = {
        // default to using standard js confirm
        confirmWithMessage: message => (confirm(message)) // eslint-disable-line no-alert
    };
    const mapStateToProps = state => ({
        projectChanged: state.scratchGui.projectChanged,
        // === Smalruby: Start of lessons button ===
        // While a challenge is open the welcome balloon would cover the lesson
        // task bar, so it stays hidden (#1498). Its state is kept and it comes
        // back after leaving. There is no first-time balloon under the Lessons
        // button (#1512).
        lessonModeActive: isLessonMode(state)
        // === Smalruby: End of lessons button ===
    });
    // === Smalruby: Start of help menu ===
    // The "?" menu's Tutorials item opens the tutorial library from here.
    const mapDispatchToProps = dispatch => ({
        onOpenTipsLibrary: () => dispatch(openTipsLibrary()),
        // === Smalruby: Start of lessons button ===
        onOpenLessonsLibrary: () => {
            dispatch(markTutorialSeen());
            dispatch(openLessonsLibrary());
        }
        // === Smalruby: End of lessons button ===
    });
    // === Smalruby: End of help menu ===
    // Allow incoming props to override redux-provided props. Used to mock in tests.
    const mergeProps = (stateProps, dispatchProps, ownProps) => Object.assign(
        {}, stateProps, dispatchProps, ownProps
    );
    return connect(
        mapStateToProps,
        mapDispatchToProps,
        mergeProps
    )(MenuBarContainer);
};

export default MenuBarHOC;
