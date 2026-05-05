import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';

import MenuComponent from '../components/menu/menu.jsx';

class Menu extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'addListeners',
            'removeListeners',
            'handleClick',
            'ref'
        ]);
    }
    componentDidMount () {
        if (this.props.open) this.addListeners();
    }
    componentDidUpdate (prevProps) {
        if (this.props.open && !prevProps.open) this.addListeners();
        if (!this.props.open && prevProps.open) this.removeListeners();
    }
    componentWillUnmount () {
        this.removeListeners();
    }
    addListeners () {
        // The Blockly workspace suppresses compat events like `mouseup`.
        // Listen for `pointerup` instead.
        document.addEventListener('pointerup', this.handleClick);
    }
    removeListeners () {
        document.removeEventListener('pointerup', this.handleClick);
    }
    handleClick (e) {
        if (!this.props.open) return;

        // Check if clicked element is a menu item (li element within menu)
        let target = e.target;
        while (target && target !== this.menu) {
            if (target.tagName === 'LI' && this.menu.contains(target)) {
                // Check if this menu item should close the menu
                const closeOnClick = target.getAttribute('data-close-on-click');
                // Default to true if attribute is not set (null)
                // closeOnClick can be "true" or "false" as a string
                if (closeOnClick === 'false') {
                    // Don't close the menu for this item
                    return;
                }
                // Clicked on a menu item, close the menu after React event handlers execute
                // In React 18, document listeners may fire before React synthetic events,
                // so we need to delay closing the menu to allow MenuItem onClick to execute
                setTimeout(() => {
                    this.props.onRequestClose();
                }, 0);
                return;
            }
            target = target.parentElement;
        }

        // Clicked outside the menu, close it after React event handlers execute
        // In React 18, document mouseup fires before React synthetic click events,
        // so delaying here allows the menu button's onClick (toggle) to run first.
        // If the button's toggle already closed the menu, onRequestClose becomes a no-op.
        if (!this.menu.contains(e.target)) {
            setTimeout(() => {
                this.props.onRequestClose();
            }, 0);
        }
    }
    ref (c) {
        this.menu = c;
    }
    render () {
        const {
            open,
            children,
            ...props
        } = this.props;
        if (!open) return null;
        return (
            <MenuComponent
                componentRef={this.ref}
                {...props}
            >
                {children}
            </MenuComponent>
        );
    }
}

Menu.propTypes = {
    children: PropTypes.node,
    onRequestClose: PropTypes.func.isRequired,
    open: PropTypes.bool.isRequired
};

export default Menu;
