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
        document.addEventListener('mouseup', this.handleClick);
    }
    removeListeners () {
        document.removeEventListener('mouseup', this.handleClick);
    }
    handleClick (e) {
        if (!this.props.open) return;

        // Check if clicked element is a menu item (li element within menu)
        let target = e.target;
        while (target && target !== this.menu) {
            if (target.tagName === 'LI' && this.menu.contains(target)) {
                // Clicked on a menu item, close the menu
                this.props.onRequestClose();
                return;
            }
            target = target.parentElement;
        }

        // Clicked outside the menu, close it
        if (!this.menu.contains(e.target)) {
            this.props.onRequestClose();
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
