# frozen_string_literal: true

module Smalruby3
  module Render
    # Shared font lookup and primitive drawing helpers for
    # TextBubble and MonitorRenderer.
    #
    # Including classes must expose `@sdl_renderer`.
    module FontSupport
      private

      def find_font
        [
          "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
          "/System/Library/Fonts/Supplemental/Hiragino Sans W3.otf",
          "/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf",
          "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
          "/System/Library/Fonts/Helvetica.ttc"
        ].find { |p| File.exist?(p) }
      end

      def fill_circle(cx, cy, r)
        r2 = r * r
        (-r..r).each do |dy|
          dx = Math.sqrt([r2 - dy * dy, 0].max).to_i
          @sdl_renderer.draw_line(cx - dx, cy + dy, cx + dx, cy + dy)
        end
      end
    end
  end
end
