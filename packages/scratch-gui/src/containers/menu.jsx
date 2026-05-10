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
            'handlePointerUp',
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
        // === Smalruby: Start of iPad menu item click fix ===
        // Menu item clicks: listen on `click` (bubble) so React's onClick on the
        // <li> fires first. iPadOS Safari has a delay between `pointerup` and
        // `click`; closing the menu in `pointerup` (even via setTimeout(0))
        // unmounts the <li> before iOS dispatches `click`, so React onClick is
        // skipped and the file picker never opens (issue: iPad Load from
        // Computer doing nothing).
        document.addEventListener('click', this.handleClick);
        // Outside clicks: keep `pointerup` because the Blockly workspace
        // suppresses compat events like `click` on workspace interactions.
        document.addEventListener('pointerup', this.handlePointerUp);
        // === Smalruby: End of iPad menu item click fix ===
    }
    removeListeners () {
        // === Smalruby: Start of iPad menu item click fix ===
        document.removeEventListener('click', this.handleClick);
        document.removeEventListener('pointerup', this.handlePointerUp);
        // === Smalruby: End of iPad menu item click fix ===
    }
    handleClick (e) {
        if (!this.props.open || !this.menu) return;

        // Check if clicked element is a menu item (li element within menu).
        // Runs in document bubble phase, after React's synthetic onClick on
        // the <li> has already fired — so closing the menu here is safe.
        let target = e.target;
        while (target && target !== this.menu) {
            if (target.tagName === 'LI' && this.menu.contains(target)) {
                const closeOnClick = target.getAttribute('data-close-on-click');
                if (closeOnClick === 'false') {
                    return;
                }
                this.props.onRequestClose();
                return;
            }
            target = target.parentElement;
        }
    }
    handlePointerUp (e) {
        if (!this.props.open || !this.menu) return;
        // Inside-menu pointerup is handled by `click` (handleClick) so the
        // menu item's React onClick gets a chance to run first.
        if (this.menu.contains(e.target)) return;
        // Outside-menu close: defer so the menu button's own onClick toggle
        // can run first. If the button already closed the menu, this becomes
        // a no-op via the open check.
        setTimeout(() => {
            if (this.props.open) this.props.onRequestClose();
        }, 0);
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
