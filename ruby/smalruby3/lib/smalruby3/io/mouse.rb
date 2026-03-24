# frozen_string_literal: true

module Smalruby3
  module IO
    class Mouse
      def initialize
        @raw_x = 0
        @raw_y = 0
        @button_down = false
      end

      # Scratch coordinate system (-240 to 240)
      def x
        @raw_x - Runtime::STAGE_WIDTH / 2
      end

      # Scratch coordinate system (-180 to 180, Y inverted)
      def y
        Runtime::STAGE_HEIGHT / 2 - @raw_y
      end

      def down?
        @button_down
      end

      def handle_motion(raw_x, raw_y)
        @raw_x = raw_x
        @raw_y = raw_y
      end

      def handle_button_down
        @button_down = true
      end

      def handle_button_up
        @button_down = false
      end
    end
  end
end
