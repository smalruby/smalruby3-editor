# frozen_string_literal: true

module Smalruby3
  module Render
    module ColorUtil
      module_function

      # Parse "#RRGGBB" hex string to [R, G, B]
      def hex_to_rgb(hex)
        hex = hex.delete_prefix("#")
        [hex[0..1].to_i(16), hex[2..3].to_i(16), hex[4..5].to_i(16)]
      end

      # Scratch color matching: top 5 bits for R/G, top 4 bits for B
      def color_matches?(color_a, color_b)
        (color_a[0] & 0xF8) == (color_b[0] & 0xF8) &&
          (color_a[1] & 0xF8) == (color_b[1] & 0xF8) &&
          (color_a[2] & 0xF0) == (color_b[2] & 0xF0)
      end

      # Mask matching: top 6 bits for all channels
      def mask_matches?(pixel_color, mask_color)
        pixel_color[3] > 0 &&
          (pixel_color[0] & 0xFC) == (mask_color[0] & 0xFC) &&
          (pixel_color[1] & 0xFC) == (mask_color[1] & 0xFC) &&
          (pixel_color[2] & 0xFC) == (mask_color[2] & 0xFC)
      end

      # Blend colors top-to-bottom (ONE + ONE_MINUS_SRC_ALPHA)
      # candidates: array of [R, G, B, A] (topmost first)
      # Returns [R, G, B]
      def blend_colors(candidates)
        r = 0.0
        g = 0.0
        b = 0.0
        remaining_alpha = 1.0

        candidates.each do |color|
          a = color[3] / 255.0
          r += color[0] * remaining_alpha
          g += color[1] * remaining_alpha
          b += color[2] * remaining_alpha
          remaining_alpha *= (1.0 - a)
          break if remaining_alpha <= 0
        end

        # Background is white
        r += remaining_alpha * 255
        g += remaining_alpha * 255
        b += remaining_alpha * 255

        [r.round.clamp(0, 255), g.round.clamp(0, 255), b.round.clamp(0, 255)]
      end

      # RGB to HSV (scratch-render exact algorithm)
      EPSILON = 1e-6

      def rgb_to_hsv(r, g, b)
        r /= 255.0
        g /= 255.0
        b /= 255.0

        k = 0.0
        if g < b
          g, b = b, g
          k = -1.0
        end
        if r < g
          r, g = g, r
          k = -2.0 / 6.0 - k
        end

        chroma = r - [g, b].min
        h = (k + (g - b) / (6.0 * chroma + EPSILON)).abs
        s = chroma / (r + EPSILON)
        v = r

        [h, s, v]
      end

      def hsv_to_rgb(h, s, v)
        return [(v * 255 + 0.5).to_i] * 3 if s == 0

        h %= 1.0
        i = (h * 6).floor
        f = h * 6 - i
        p = v * (1 - s)
        q = v * (1 - s * f)
        t = v * (1 - s * (1 - f))

        r, g, b = case i % 6
                  when 0 then [v, t, p]
                  when 1 then [q, v, p]
                  when 2 then [p, v, t]
                  when 3 then [p, q, v]
                  when 4 then [t, p, v]
                  when 5 then [v, p, q]
                  end

        [(r * 255 + 0.5).to_i, (g * 255 + 0.5).to_i, (b * 255 + 0.5).to_i]
      end
    end
  end
end
