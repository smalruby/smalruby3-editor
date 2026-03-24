# frozen_string_literal: true

module Smalruby3
  module Extension
    class Music
      DEFAULT_TEMPO = 60 # BPM

      # MIDI note number to frequency (A4 = 440Hz)
      def self.note_to_freq(note)
        440.0 * (2.0**((note - 69) / 12.0))
      end

      attr_reader :sprite

      def initialize(sprite)
        @sprite = sprite
        @tempo = DEFAULT_TEMPO
        @instrument = 1
      end

      def play_drum(drum:, beats:)
        # Stub: play drum sample for given beats
        wait_beats(beats)
      end

      def play_note(note:, beats:)
        # Stub: generate tone at note frequency for given beats
        # freq = self.class.note_to_freq(note)
        wait_beats(beats)
      end

      def rest(beats)
        wait_beats(beats)
      end

      def instrument=(value)
        @instrument = value.to_i.clamp(1, 21)
      end

      def instrument
        @instrument
      end

      def tempo=(value)
        @tempo = [value.to_f, 20].max
      end

      def tempo
        @tempo
      end

      private

      def wait_beats(beats)
        seconds = beats.to_f * 60.0 / @tempo
        frames = (seconds * Runtime::FPS).ceil
        frames = 1 if frames < 1
        frames.times { Fiber.yield }
      end
    end
  end
end
