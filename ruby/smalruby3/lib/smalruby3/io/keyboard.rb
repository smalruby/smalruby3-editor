# frozen_string_literal: true

module Smalruby3
  module IO
    class Keyboard
      # Scratch key name → SDL2 scancode mapping
      SCRATCH_KEY_MAP = {
        "space" => 44,       # SDL2::Key::Scan::SPACE
        "left arrow" => 80,  # SDL2::Key::Scan::LEFT
        "right arrow" => 79, # SDL2::Key::Scan::RIGHT
        "up arrow" => 82,    # SDL2::Key::Scan::UP
        "down arrow" => 81,  # SDL2::Key::Scan::DOWN
        "enter" => 40,       # SDL2::Key::Scan::RETURN
      }.freeze

      def initialize
        @pressed = {}
      end

      def pressed?(key_name)
        scancode = resolve_scancode(key_name)
        return false unless scancode
        @pressed[scancode] || false
      end

      def handle_key_down(scancode)
        @pressed[scancode] = true
      end

      def handle_key_up(scancode)
        @pressed.delete(scancode)
      end

      def any_pressed?
        !@pressed.empty?
      end

      def scancode_to_scratch_name(scancode)
        REVERSE_MAP[scancode]
      end

      REVERSE_MAP = {}.tap do |m|
        SCRATCH_KEY_MAP.each { |name, code| m[code] = name }
        # a-z
        ("a".."z").each { |ch| m[4 + (ch.ord - "a".ord)] = ch }
        # 0-9
        m[39] = "0"
        ("1".."9").each { |ch| m[30 + (ch.ord - "1".ord)] = ch }
      end.freeze

      private

      def resolve_scancode(key_name)
        return SCRATCH_KEY_MAP[key_name] if SCRATCH_KEY_MAP.key?(key_name)

        if key_name.length == 1
          ch = key_name.downcase
          if ch >= "a" && ch <= "z"
            # SDL2 scancodes for a-z: 4-29
            return 4 + (ch.ord - "a".ord)
          elsif ch >= "0" && ch <= "9"
            # SDL2 scancodes for 0: 39, 1-9: 30-38
            return ch == "0" ? 39 : 30 + (ch.ord - "1".ord)
          end
        end

        nil
      end
    end
  end
end
