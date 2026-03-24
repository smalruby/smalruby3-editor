# frozen_string_literal: true

module Smalruby3
  module Render
    class Silhouette
      attr_reader :width, :height

      def initialize(surface)
        @width = surface.w
        @height = surface.h
        @pixels = surface.pixels
        @pitch = surface.pitch
      end

      # Check if pixel at texture coordinates [0,1] is opaque (nearest neighbor)
      def opaque_at?(tex_x, tex_y)
        px = (tex_x * (@width - 1)).floor
        py = (tex_y * (@height - 1)).floor
        return false if px < 0 || px >= @width || py < 0 || py >= @height
        alpha_at(px, py) > 0
      end

      # Check if any of the 4 corner pixels is opaque (bilinear sampling)
      def opaque_at_linear?(tex_x, tex_y)
        x = (tex_x * (@width - 1))
        y = (tex_y * (@height - 1))
        xf = x.floor
        yf = y.floor
        alpha_at(xf, yf) > 0 ||
          alpha_at(xf + 1, yf) > 0 ||
          alpha_at(xf, yf + 1) > 0 ||
          alpha_at(xf + 1, yf + 1) > 0
      end

      # Get RGBA color at texture coordinates [0,1]
      # Returns [R, G, B, A] (0-255)
      def color_at(tex_x, tex_y)
        px = (tex_x * (@width - 1)).floor.clamp(0, @width - 1)
        py = (tex_y * (@height - 1)).floor.clamp(0, @height - 1)
        color_at_pixel(px, py)
      end

      # Get RGBA at pixel coordinates (premultiplied alpha)
      def color_at_pixel(px, py)
        return [0, 0, 0, 0] if px < 0 || px >= @width || py < 0 || py >= @height
        offset = (py * @pitch) + (px * 4)
        # SDL2 ARGB8888 format (little-endian): bytes are B, G, R, A
        b = @pixels.getbyte(offset)
        g = @pixels.getbyte(offset + 1)
        r = @pixels.getbyte(offset + 2)
        a = @pixels.getbyte(offset + 3)
        [r, g, b, a]
      end

      private

      def alpha_at(px, py)
        return 0 if px < 0 || px >= @width || py < 0 || py >= @height
        offset = (py * @pitch) + (px * 4) + 3 # Alpha channel
        @pixels.getbyte(offset)
      end
    end
  end
end
