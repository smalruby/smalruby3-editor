import StartAudioContext from 'startaudiocontext';
import bowser from 'bowser';

let AUDIO_CONTEXT;

if (!bowser.msie) {
    /**
     * AudioContext can be initialized only when user interaction event happens
     */
    const initAudioContext = () => {
        document.removeEventListener('mousedown', initAudioContext);
        document.removeEventListener('touchstart', initAudioContext);
        document.removeEventListener('keydown', initAudioContext);
        if (AUDIO_CONTEXT) return;

        AUDIO_CONTEXT = new (window.AudioContext ||
            window.webkitAudioContext)();
        StartAudioContext(AUDIO_CONTEXT);
    };
    document.addEventListener('mousedown', initAudioContext);
    document.addEventListener('touchstart', initAudioContext);
    document.addEventListener('keydown', initAudioContext);
}

/**
 * Wrap browser AudioContext because we shouldn't create more than one
 * @returns {AudioContext} The singleton AudioContext
 */
export default function () {
    // === Smalruby: lazily create the AudioContext on first request so that
    // the sound tab works even when the user navigates directly to it via
    // ?tab=sounds without a prior real mousedown / touchstart / keydown
    // (e.g. Playwright tests). The browser may suspend the context until
    // a real user gesture, but createBuffer / createBufferSource still work
    // and the context resumes automatically once the user interacts.
    if (!AUDIO_CONTEXT && typeof window !== 'undefined' && !bowser.msie) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (Ctor) {
            AUDIO_CONTEXT = new Ctor();
            StartAudioContext(AUDIO_CONTEXT);
        }
    }
    return AUDIO_CONTEXT;
}
