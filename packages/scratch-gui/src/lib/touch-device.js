/**
 * Detect whether the current device has a touch screen.
 *
 * Used to decide whether touch-only UI (e.g. the software keyboard toggle
 * button in the Ruby toolbar) should be rendered. Matches the
 * `maxTouchPoints` half of Monaco's iOS detection, but intentionally covers
 * Android and other touch devices as well.
 * @returns {boolean} true if the device reports touch capability.
 */
const isTouchDevice = () => typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0;

export { isTouchDevice };
