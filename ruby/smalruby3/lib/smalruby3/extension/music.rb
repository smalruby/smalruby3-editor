# frozen_string_literal: true

module Smalruby3
  module Extension
    class Music
      DEFAULT_TEMPO = 60 # BPM

      DRUM_FILES = [
        "1-snare", "2-bass-drum", "3-side-stick", "4-crash-cymbal",
        "5-open-hi-hat", "6-closed-hi-hat", "7-tambourine", "8-hand-clap",
        "9-claves", "10-wood-block", "11-cowbell", "12-triangle",
        "13-bongo", "14-conga", "15-cabasa", "16-guiro",
        "17-vibraslap", "18-cuica"
      ].freeze

      # Each instrument: [dir_name, [sample_notes], release_time]
      INSTRUMENT_INFO = [
        ["1-piano", [24, 36, 48, 60, 72, 84, 96, 108], 0.5],
        ["2-electric-piano", [60], 0.5],
        ["3-organ", [60], 0.5],
        ["4-guitar", [60], 0.5],
        ["5-electric-guitar", [60], 0.5],
        ["6-bass", [36, 48], 0.25],
        ["7-pizzicato", [60], 0.25],
        ["8-cello", [36, 48, 60], 0.1],
        ["9-trombone", [36, 48, 60], 0.0],
        ["10-clarinet", [48, 60], 0.0],
        ["11-saxophone", [36, 60, 84], 0.0],
        ["12-flute", [60, 72], 0.0],
        ["13-wooden-flute", [60, 72], 0.0],
        ["14-bassoon", [36, 48, 60], 0.0],
        ["15-choir", [48, 60, 72], 0.25],
        ["16-vibraphone", [60, 72], 0.5],
        ["17-music-box", [60], 0.25],
        ["18-steel-drum", [60], 0.5],
        ["19-marimba", [60], 0.0],
        ["20-synth-lead", [60], 0.1],
        ["21-synth-pad", [60], 0.25]
      ].freeze

      def self.note_to_freq(note)
        440.0 * (2.0**((note - 69) / 12.0))
      end

      attr_reader :sprite, :instrument, :tempo

      def initialize(sprite)
        @sprite = sprite
        @tempo = DEFAULT_TEMPO
        @instrument = 1
        @drum_chunks = {}
        @instrument_chunks = {}
      end

      def play_drum(drum:, beats:)
        drum_idx = (drum.to_i - 1).clamp(0, DRUM_FILES.size - 1)
        chunk = load_drum(drum_idx)
        if chunk
          ch = play_chunk(chunk)
          schedule_release(ch, beats, 0.01) if ch
        end
        wait_beats(beats)
      end

      def play_note(note:, beats:)
        inst_idx = (@instrument - 1).clamp(0, INSTRUMENT_INFO.size - 1)
        target_note = note.to_i
        info = INSTRUMENT_INFO[inst_idx]
        return wait_beats(beats) unless info

        sample_note = select_sample(target_note, info[1])
        chunk = load_instrument_note(inst_idx, target_note)
        if chunk
          pitch = 2.0**((target_note - sample_note) / 12.0)
          ch = play_pitched_chunk(chunk, pitch)
          schedule_release(ch, beats, info[2]) if ch
        end
        wait_beats(beats)
      end

      def rest(beats)
        wait_beats(beats)
      end

      def instrument=(value)
        @instrument = value.to_i.clamp(1, 21)
      end

      def tempo=(value)
        @tempo = [value.to_f, 20].max
      end

      private

      def assets_dir
        File.expand_path("../../../assets/music", __dir__)
      end

      def load_drum(idx)
        @drum_chunks[idx] ||= begin
          path = File.join(assets_dir, "drums", "#{DRUM_FILES[idx]}.mp3")
          return nil unless File.exist?(path)
          SDL2::Mixer::Chunk.load(path)
        end
      end

      def load_instrument_note(inst_idx, note)
        info = INSTRUMENT_INFO[inst_idx]
        return nil unless info

        dir_name, samples, = info
        sample_note = select_sample(note, samples)
        cache_key = "#{inst_idx}:#{sample_note}"

        @instrument_chunks[cache_key] ||= begin
          path = File.join(assets_dir, "instruments", dir_name, "#{sample_note}.mp3")
          return nil unless File.exist?(path)
          SDL2::Mixer::Chunk.load(path)
        end
      end

      # Select the closest sample at or below the target note
      def select_sample(note, samples)
        selected = samples[0]
        samples.reverse_each do |s|
          if note >= s
            selected = s
            break
          end
        end
        selected
      end

      def play_chunk(chunk)
        ch = find_free_channel
        SDL2::Mixer::Channels.play(ch, chunk, 0)
        ch
      rescue => e
        warn "[Smalruby3] Music play failed: #{e.message}"
        nil
      end

      def play_pitched_chunk(chunk, pitch)
        ch = find_free_channel
        if (pitch - 1.0).abs < Float::EPSILON
          SDL2::Mixer::Channels.play(ch, chunk, 0)
        else
          SDL2::Mixer::Channels.play_pitched(ch, chunk, pitch)
        end
        ch
      rescue => e
        warn "[Smalruby3] Music play failed: #{e.message}"
        nil
      end

      # Schedule a note to fade out after duration, matching Scratch's
      # release envelope: play for duration_sec, then fade over release_sec.
      def schedule_release(ch, beats, release_time)
        return unless ch && ch >= 0

        duration_ms = (beats.to_f * 60.0 / @tempo * 1000).to_i
        release_ms = ((release_time || 0.01) * 1000).to_i
        release_ms = [release_ms, 10].max

        # Fade out starting at duration_ms, over release_ms
        total_ms = duration_ms + release_ms
        SDL2::Mixer::Channels.expire(ch, total_ms)
      rescue => e
        warn "[Smalruby3] Music release failed: #{e.message}"
      end

      def find_free_channel
        # Find first free channel among 0-15
        16.times do |ch|
          return ch unless SDL2::Mixer::Channels.play?(ch)
        end
        -1 # Let SDL2 pick any channel
      end

      def wait_beats(beats)
        seconds = beats.to_f * 60.0 / @tempo
        frames = (seconds * Runtime::FPS).ceil
        frames = 1 if frames < 1
        frames.times { Fiber.yield }
      end
    end
  end
end
