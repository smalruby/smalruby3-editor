// This was originally a thin wrapper around `react-ga`, which only supports UA.
// We now use GTM, so we could use `react-gtm-module`, but it doesn't support GTM environments (GTM_ENV_AUTH).
// So we use the GTM snippets directly.


// === Smalruby: Start of extra GA params ===
// Extra data layer keys pushed so far (reset on later events that do not set them).
const pushedExtraKeys = new Set();
// === Smalruby: End of extra GA params ===

/**
 * Report analytics to GA4 using an interface similar to the 'react-ga' module we were using for UA.
 */
const GA4 = {
    // === Smalruby: Start of extra GA params ===
    // Extra fields (e.g. the lessons' page / seconds) are pushed as data layer variables
    // alongside action / label, so they can be aggregated without parsing the label.
    // The GTM data layer keeps the last pushed value of every key, so extra keys pushed
    // by an earlier event are reset to undefined on later events that do not set them
    // (otherwise e.g. the lessons' course_id would stick to a later ruby_tab event).
    event: ({category, action, label, ...params}) => {
        window.dataLayer = window.dataLayer || [];
        const reset = {};
        pushedExtraKeys.forEach(key => {
            reset[key] = undefined; // eslint-disable-line no-undefined
        });
        Object.keys(params).forEach(key => pushedExtraKeys.add(key));
        // There is no perfect mapping from UA to GA4
        // See https://support.google.com/analytics/answer/11091025
        window.dataLayer.push({
            ...reset,
            ...params,
            event: category,
            action,
            label
        });
    }
    // === Smalruby: End of extra GA params ===
};

export default GA4;
