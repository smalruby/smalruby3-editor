# frozen_string_literal: true

module Smalruby3
  module Extension
    class Pen
      attr_reader :sprite

      def initialize(sprite)
        @sprite = sprite
        @is_down = false
        @color_h = 66.66   # Scratch default pen color (blue)
        @color_s = 100.0
        @color_b = 100.0
        @transparency = 0.0
        @size = 1.0
        @last_x = nil
        @last_y = nil
      end

      def down
        @is_down = true
        @last_x = @sprite.x
        @last_y = @sprite.y
      end

      def up
        @is_down = false
        @last_x = nil
        @last_y = nil
      end

      def down?
        @is_down
      end

      def clear
        pen_skin&.clear
      end

      def stamp
        renderer = @sprite.runtime.renderer
        renderer&.stamp_sprite(@sprite)
      end

      # Called by sprite when position changes (if pen is down)
      def on_move
        return unless @is_down
        return unless @last_x && @last_y

        new_x = @sprite.x
        new_y = @sprite.y
        return if new_x == @last_x && new_y == @last_y

        renderer = @sprite.runtime.renderer
        if renderer
          stage_w = Runtime::STAGE_WIDTH
          stage_h = Runtime::STAGE_HEIGHT
          sx1 = (stage_w / 2.0 + @last_x).to_i
          sy1 = (stage_h / 2.0 - @last_y).to_i
          sx2 = (stage_w / 2.0 + new_x).to_i
          sy2 = (stage_h / 2.0 - new_y).to_i
          renderer.pen_draw_line(sx1, sy1, sx2, sy2, rgba_color, @size)
        end

        @last_x = new_x
        @last_y = new_y
      end

      # --- Color properties ---

      def color=(value)
        if value.is_a?(String) && value.start_with?("#")
          rgb = Render::ColorUtil.hex_to_rgb(value)
          h, s, v = Render::ColorUtil.rgb_to_hsv(*rgb)
          @color_h = h * 100
          @color_s = s * 100
          @color_b = v * 100
        else
          @color_h = value.to_f % 100
        end
      end

      def color
        @color_h
      end

      def saturation=(value)
        @color_s = value.to_f.clamp(0, 100)
      end

      def saturation
        @color_s
      end

      def brightness=(value)
        @color_b = value.to_f.clamp(0, 100)
      end

      def brightness
        @color_b
      end

      def transparency=(value)
        @transparency = value.to_f.clamp(0, 100)
      end

      attr_reader :transparency

      def size=(value)
        @size = [value.to_f, 1.0].max
      end

      attr_reader :size

      private

      def rgba_color
        r, g, b = Render::ColorUtil.hsv_to_rgb(
          @color_h / 100.0,
          @color_s / 100.0,
          @color_b / 100.0
        )
        a = ((100 - @transparency) * 255 / 100.0).round.clamp(0, 255)
        [r, g, b, a]
      end

      def pen_skin
        @sprite.runtime.renderer&.pen_skin
      end
    end
  end
end
