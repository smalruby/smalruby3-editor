import React from 'react';

/* Higher Order Component to get parameters from the URL query string and initialize redux state
 * Note: Tutorial functionality has been removed from Smalruby.
 * This HOC is now a pass-through to maintain compatibility.
 * @param {React.Component} WrappedComponent: component to render
 * @returns {React.Component} component with query parsing behavior
 */
const QueryParserHOC = function (WrappedComponent) {
    // Return the wrapped component as-is without any query parsing
    return WrappedComponent;
};

export {
    QueryParserHOC as default
};
