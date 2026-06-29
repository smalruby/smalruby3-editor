import SharedAudioContext from './shared-audio-context.js';

class AudioBufferPlayer {
    constructor (samples, sampleRate) {
        this.audioContext = new SharedAudioContext();
        // === Smalruby: Start of null-safe AudioContext (issue #633) ===
        // When the sounds tab is opened by direct navigation (?tab=sounds), no
        // user gesture has happened yet, so the shared AudioContext does not
        // exist and createBuffer() would throw. Keep the samples and create the
        // buffer lazily once the first user gesture creates the shared context.
        // We intentionally do NOT eagerly create the AudioContext here: doing so
        // before a gesture yields a suspended context and reintroduces the
        // "silent sound block" autoplay-policy bug (see issue #633).
        this.samples = samples;
        this.sampleRate = sampleRate;
        this._buffer = null;
        this.ensureBuffer();
        // === Smalruby: End of null-safe AudioContext (issue #633) ===
        this.source = null;

        this.startTime = null;
        this.updateCallback = null;
        this.trimStart = null;
        this.trimEnd = null;
    }

    // === Smalruby: Start of null-safe AudioContext (issue #633) ===
    /**
     * The playback buffer. Read lazily so every caller (play, effects, copy,
     * resampling) transparently gets the buffer created on first access once a
     * user gesture has produced the shared AudioContext. Returns null before
     * then (e.g. ?tab=sounds direct navigation), so callers must null-check.
     * @returns {?AudioBuffer} the playback buffer, or null if no context exists yet.
     */
    get buffer () {
        return this.ensureBuffer();
    }

    /**
     * Lazily acquire the shared AudioContext (created by the first user gesture)
     * and build the playback buffer. Safe to call repeatedly; it is a no-op once
     * the buffer exists and returns null while no AudioContext is available.
     *
     * Note: before any user gesture, `new SharedAudioContext()` returns a bare
     * object without `createBuffer` (the shared context is still undefined), so
     * we probe for the method rather than for truthiness.
     * @returns {?AudioBuffer} the playback buffer, or null if no context exists yet.
     */
    ensureBuffer () {
        if (this._buffer) return this._buffer;
        if (!this._hasAudioContext()) {
            // A user gesture may have created the shared context since construction.
            this.audioContext = new SharedAudioContext();
        }
        if (!this._hasAudioContext()) return null;
        this._buffer = this.audioContext.createBuffer(1, this.samples.length, this.sampleRate);
        this._buffer.getChannelData(0).set(this.samples);
        return this._buffer;
    }
    _hasAudioContext () {
        return Boolean(this.audioContext && typeof this.audioContext.createBuffer === 'function');
    }
    // === Smalruby: End of null-safe AudioContext (issue #633) ===

    play (trimStart, trimEnd, onUpdate, onEnded) {
        // === Smalruby: Start of null-safe AudioContext (issue #633) ===
        // No AudioContext yet (no user gesture): nothing can be played.
        const buffer = this.ensureBuffer();
        if (!buffer) return;
        // === Smalruby: End of null-safe AudioContext (issue #633) ===
        this.updateCallback = onUpdate;
        this.trimStart = trimStart;
        this.trimEnd = trimEnd;
        this.startTime = Date.now();

        const trimStartTime = buffer.duration * trimStart;
        const trimmedDuration = (buffer.duration * trimEnd) - trimStartTime;

        this.source = this.audioContext.createBufferSource();
        this.source.onended = onEnded;
        this.source.buffer = buffer;
        this.source.connect(this.audioContext.destination);
        this.source.start(0, trimStartTime, trimmedDuration);

        this.update();
    }

    update () {
        const timeSinceStart = (Date.now() - this.startTime) / 1000;
        const percentage = timeSinceStart / this.buffer.duration;
        if (percentage + this.trimStart < this.trimEnd && this.source.onended) {
            requestAnimationFrame(this.update.bind(this));
            this.updateCallback(percentage + this.trimStart);
        } else {
            this.updateCallback = null;
        }
    }

    stop () {
        if (this.source) {
            this.source.onended = null; // Do not call onEnded callback if manually stopped
            try {
                this.source.stop();
            } catch (e) {
                // This is probably Safari, which dies when you call stop more than once
                // which the spec says is allowed: https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode
                console.log('Caught error while stopping buffer source node.'); // eslint-disable-line no-console
            }
        }
    }
}

export default AudioBufferPlayer;
