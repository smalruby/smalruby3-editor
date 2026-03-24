# frozen_string_literal: true

module Smalruby3
  module Render
    class Drawable
      attr_accessor :x, :y, :direction, :scale_x, :scale_y
      attr_accessor :visible, :skin

      def initialize
        @x = 0
        @y = 0
        @direction = 90
        @scale_x = 100
        @scale_y = 100
        @visible = true
        @skin = nil
      end

      # Convert Scratch world coordinates to SDL2 screen coordinates
      def self.scratch_to_screen(scratch_x, scratch_y, stage_width, stage_height)
        screen_x = (stage_width / 2.0 + scratch_x).to_i
        screen_y = (stage_height / 2.0 - scratch_y).to_i
        [screen_x, screen_y]
      end

      # Convert SDL2 screen coordinates to Scratch world coordinates
      def self.screen_to_scratch(screen_x, screen_y, stage_width, stage_height)
        scratch_x = screen_x - stage_width / 2.0
        scratch_y = stage_height / 2.0 - screen_y
        [scratch_x, scratch_y]
      end
    end
  end
end
