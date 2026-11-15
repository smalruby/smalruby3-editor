/**
 * Ask the browser's own question before reloading or closing the tab, only
 * while `active` (#1923 C4: grades not exported / comments not returned on the
 * grading screen). Not with `?no_beforeunload=1` (tests and Playwright).
 */
import { useEffect } from 'react';
import { getUrlParams } from '../lib/url-params.js';

/**
 * @param {boolean} active - whether leaving the page would lose work now
 */
const useBeforeUnloadWhile = (active) => {
    useEffect(() => {
        if (!active || getUrlParams().noBeforeUnload) return () => {};
        const handleBeforeUnload = (e) => {
            e.preventDefault();
            // Older browsers need returnValue set to show the question.
            e.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [active]);
};

export default useBeforeUnloadWhile;
