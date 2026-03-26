# frozen_string_literal: true

module Smalruby3
  class Sound
    attr_reader :name, :path

    def initialize(name:, path:)
      @name = name
      @path = path
      @chunk = nil
    end

    # Load the sound chunk via SDL2::Mixer.
    # Returns the Chunk object, or nil if loading fails.
    def chunk
      @chunk ||= load_chunk
    end

    private

    def load_chunk
      return nil unless @path && File.exist?(@path)
      SDL2::Mixer::Chunk.load(@path)
    rescue => e
      warn "[Smalruby3] Failed to load sound #{@name}: #{e.message}"
      nil
    end
  end
end
