import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { connect } from 'react-redux';
import { JAPANESE_TAB_INDEX } from '../../reducers/editor-tab';
import { toggleSmalrubyConsole } from '../../reducers/smalruby-console.js';
import consoleIcon from './icon--console.svg';
import styles from './smalruby-console-button.css';

const EXTENSION_ID = 'smalrubyConsole';
const EVENTS = ['EXTENSION_ADDED', 'PROJECT_LOADED'];

const messages = defineMessages({
    show: {
        id: 'gui.smalrubyConsole.showButton',
        defaultMessage: 'Show the console',
        description: 'Button on the stage header that shows the console in place of the stage',
    },
    hide: {
        id: 'gui.smalrubyConsole.hideButton',
        defaultMessage: 'Hide the console',
        description: 'Button on the stage header that hides the console and shows the stage again',
    },
});

/**
 * Whether the project uses the console extension, kept up to date from the VM.
 * @param {?object} vm - The VM.
 * @returns {boolean} True if it is loaded.
 */
const useConsoleExtensionLoaded = (vm) => {
    const read = () => Boolean(vm && vm.extensionManager && vm.extensionManager.isExtensionLoaded(EXTENSION_ID));
    const [loaded, setLoaded] = useState(read);
    useEffect(() => {
        if (!vm || typeof vm.on !== 'function') return () => {};
        // EXTENSION_ADDED comes before isExtensionLoaded() turns true: read again after the task.
        const timers = new Set();
        const update = () => {
            setLoaded(read());
            const timer = setTimeout(() => {
                timers.delete(timer);
                setLoaded(read());
            }, 0);
            timers.add(timer);
        };
        EVENTS.forEach((name) => vm.on(name, update));
        update();
        return () => {
            EVENTS.forEach((name) => vm.removeListener(name, update));
            timers.forEach((timer) => clearTimeout(timer));
        };
    }, [vm]);
    return loaded;
};

/**
 * The console button next to the green flag and stop: switches the stage and the
 * console. Shown when the project uses the console extension (or the console is shown),
 * and always in the Japanese tab, where the console is the stage of the program (B07: a
 * project that prints nothing could not show the console again once hidden).
 * The number is how many lines were printed while the console was hidden.
 * @param {object} props - The props.
 * @param {boolean} props.alwaysShown - Whether to show it without the extension (the Japanese tab).
 * @param {boolean} props.isOpen - Whether the console is shown.
 * @param {number} props.unread - The lines printed while hidden.
 * @param {?object} props.vm - The VM.
 * @param {Function} props.onToggle - Shows or hides the console.
 * @returns {?React.ReactElement} The button, or null.
 */
const SmalrubyConsoleButton = ({ alwaysShown = false, isOpen, unread, vm, onToggle }) => {
    const intl = useIntl();
    const loaded = useConsoleExtensionLoaded(vm);
    if (!loaded && !isOpen && !alwaysShown) return null;
    const title = intl.formatMessage(isOpen ? messages.hide : messages.show);
    return (
        <button
            aria-label={title}
            aria-pressed={isOpen}
            className={classNames(styles.button, { [styles.isOpen]: isOpen })}
            data-testid="smalruby-console-button"
            onClick={onToggle}
            title={title}
            type="button"
        >
            <img alt="" className={styles.icon} draggable={false} src={consoleIcon} />
            {!isOpen && unread > 0 ? (
                <span aria-hidden="true" className={styles.badge} data-testid="smalruby-console-button-unread">
                    {unread > 99 ? '99+' : unread}
                </span>
            ) : null}
        </button>
    );
};

SmalrubyConsoleButton.propTypes = {
    alwaysShown: PropTypes.bool,
    isOpen: PropTypes.bool.isRequired,
    onToggle: PropTypes.func.isRequired,
    unread: PropTypes.number.isRequired,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => ({
    alwaysShown: state.scratchGui.editorTab.activeTabIndex === JAPANESE_TAB_INDEX,
    isOpen: state.scratchGui.smalrubyConsole.visible,
    unread: state.scratchGui.smalrubyConsole.unread,
});

const mapDispatchToProps = (dispatch) => ({
    onToggle: () => dispatch(toggleSmalrubyConsole()),
});

export { SmalrubyConsoleButton };
export default connect(mapStateToProps, mapDispatchToProps)(SmalrubyConsoleButton);
