import { useEffect, useRef, useState } from 'react';

/**
 * Counts down whole seconds while `active` (the start buttons are on screen right after joining).
 * Once it has reached 0 it never counts again in this mount, so going back a page and returning
 * to the last page does not make the student wait twice. Leaving the last page before the end
 * stops it, and coming back starts it again from `seconds`. The interval is cleared on unmount.
 * @param {number} seconds - whole seconds to wait (readWaitSeconds)
 * @param {boolean} active - whether the wait is running
 * @returns {number} seconds left (0 = the buttons can be pressed)
 */
const useReadCountdown = (seconds, active) => {
    const doneRef = useRef(false);
    // null = not started yet (before the effect runs, still report the full wait so the
    // button is never pressable for one frame)
    const [left, setLeft] = useState(null);
    useEffect(() => {
        if (!active || doneRef.current || !(seconds > 0)) {
            setLeft(null);
            return;
        }
        let remaining = seconds;
        setLeft(remaining);
        const id = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                doneRef.current = true;
                clearInterval(id);
            }
            setLeft(Math.max(0, remaining));
        }, 1000);
        return () => clearInterval(id);
    }, [active, seconds]);
    if (!active || doneRef.current || !(seconds > 0)) return 0;
    return left === null ? seconds : left;
};

export default useReadCountdown;
