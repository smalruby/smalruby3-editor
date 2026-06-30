import AudioBufferPlayer from '../../../src/lib/audio/audio-buffer-player.js';
import SharedAudioContext from '../../../src/lib/audio/shared-audio-context.js';

jest.mock('../../../src/lib/audio/shared-audio-context.js');

const makeFakeAudioContext = () => {
    const channelData = new Float32Array(3);
    const buffer = {
        duration: 1,
        length: 3,
        sampleRate: 44100,
        getChannelData: jest.fn(() => channelData),
    };
    const source = {
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        onended: null,
    };
    return {
        buffer,
        source,
        createBuffer: jest.fn(() => buffer),
        createBufferSource: jest.fn(() => source),
        destination: {},
    };
};

describe('AudioBufferPlayer null-safe AudioContext handling (issue #633)', () => {
    const samples = new Float32Array([0, 0, 0]);
    const sampleRate = 44100;

    beforeEach(() => {
        SharedAudioContext.mockReset();
    });

    test('does not throw when no AudioContext exists yet (?tab=sounds direct nav)', () => {
        // No user gesture has happened yet, so SharedAudioContext returns undefined.
        SharedAudioContext.mockReturnValue(undefined);

        let player;
        expect(() => {
            player = new AudioBufferPlayer(samples, sampleRate);
        }).not.toThrow();
        expect(player.buffer).toBeNull();
    });

    test('play() and stop() are safe no-ops when no AudioContext exists', () => {
        SharedAudioContext.mockReturnValue(undefined);
        const player = new AudioBufferPlayer(samples, sampleRate);

        const onUpdate = jest.fn();
        const onEnded = jest.fn();
        expect(() => player.play(0, 1, onUpdate, onEnded)).not.toThrow();
        expect(() => player.stop()).not.toThrow();
        expect(player.buffer).toBeNull();
    });

    test('creates the buffer eagerly when an AudioContext already exists (normal flow)', () => {
        const ctx = makeFakeAudioContext();
        SharedAudioContext.mockReturnValue(ctx);

        const player = new AudioBufferPlayer(samples, sampleRate);
        expect(ctx.createBuffer).toHaveBeenCalledWith(1, samples.length, sampleRate);
        expect(player.buffer).toBe(ctx.buffer);
    });

    test('creates the buffer lazily once an AudioContext becomes available (first gesture)', () => {
        // Constructor runs before any gesture: no context.
        SharedAudioContext.mockReturnValue(undefined);
        const player = new AudioBufferPlayer(samples, sampleRate);
        expect(player.buffer).toBeNull();

        // First user gesture creates the shared context; the next access acquires it.
        const ctx = makeFakeAudioContext();
        SharedAudioContext.mockReturnValue(ctx);

        const onUpdate = jest.fn();
        const onEnded = jest.fn();
        player.play(0, 1, onUpdate, onEnded);

        expect(ctx.createBuffer).toHaveBeenCalledWith(1, samples.length, sampleRate);
        expect(ctx.createBufferSource).toHaveBeenCalled();
        expect(ctx.source.start).toHaveBeenCalled();
        expect(player.buffer).toBe(ctx.buffer);
    });
});
