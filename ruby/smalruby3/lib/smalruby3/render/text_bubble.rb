# frozen_string_literal: true

require "sdl2"

module Smalruby3
  module Render
    # Renders say/think speech bubbles matching Scratch's TextBubbleSkin.
    # Draws directly via SDL2 renderer (not surface-based).
    class TextBubble
      MAX_TEXT_LENGTH = 330
      MAX_LINE_WIDTH = 170
      MIN_WIDTH = 50
      PADDING = 10
      CORNER_RADIUS = 16
      TAIL_HEIGHT = 12
      STROKE_WIDTH = 4
      FONT_SIZE = 14
      LINE_HEIGHT = 16

      TEXT_COLOR = [87, 94, 117].freeze     # #575E75
      FILL_COLOR = [255, 255, 255, 255].freeze
      STROKE_COLOR = [0, 0, 0, 38].freeze  # rgba(0,0,0,0.15)

      def initialize(sdl_renderer)
        @sdl_renderer = sdl_renderer
        @font = nil
        @on_right = {} # sprite.object_id => bool
      end

      def draw(sprite, stage_width, stage_height)
        text = sprite.say_text || sprite.think_text
        return unless text && !text.empty?

        type = sprite.say_text ? :say : :think
        ensure_font
        return unless @font

        truncated = (text.length > MAX_TEXT_LENGTH) ? text[0, MAX_TEXT_LENGTH] : text
        lines = wrap_text(truncated)
        return if lines.empty?

        longest_w = lines.map { |l| @font.size_text(l)[0] }.max
        text_w = [longest_w, MIN_WIDTH].max
        text_h = LINE_HEIGHT * lines.size

        bw = text_w + PADDING * 2 + STROKE_WIDTH
        bh = text_h + PADDING * 2 + STROKE_WIDTH

        x, y, on_right = calc_position(
          sprite, bw, bh, stage_width, stage_height
        )

        draw_bubble(x, y, bw, bh, type, on_right)
        draw_lines(lines, x, y)
      end

      def destroy
        @font&.destroy
        @font = nil
      end

      private

      def ensure_font
        return if @font

        SDL2::TTF.init
        path = find_font
        @font = SDL2::TTF.open(path, FONT_SIZE) if path
      end

      def find_font
        [
          "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
          "/System/Library/Fonts/Supplemental/Hiragino Sans W3.otf",
          "/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf",
          "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
          "/System/Library/Fonts/Helvetica.ttc"
        ].find { |p| File.exist?(p) }
      end

      # --- Text wrapping (character-by-character for CJK support) ---

      def wrap_text(text)
        return [""] if text.empty?

        lines = []
        text.split("\n").each do |para|
          if para.empty?
            lines << ""
          else
            wrap_paragraph(para, lines)
          end
        end
        lines.empty? ? [""] : lines
      end

      def wrap_paragraph(para, lines)
        current = ""
        buf = "" # word buffer for non-CJK

        para.each_char do |ch|
          if ch == " "
            # Flush buffer + space
            buf += ch
          elsif cjk?(ch)
            # Flush any buffered word first
            current = flush_word(buf, current, lines) unless buf.empty?
            buf = ""
            # Try adding CJK char
            test = current + ch
            w, = @font.size_text(test)
            if w <= MAX_LINE_WIDTH
              current = test
            else
              lines << current unless current.empty?
              current = ch
            end
          else
            buf += ch
          end
        end

        # Flush remaining buffer
        current = flush_word(buf, current, lines) unless buf.empty?
        lines << current unless current.empty?
      end

      def flush_word(word, current, lines)
        test = current + word
        w, = @font.size_text(test)
        if w <= MAX_LINE_WIDTH
          test
        else
          lines << current unless current.empty?
          word.lstrip
        end
      end

      def cjk?(ch)
        cp = ch.ord
        cp.between?(0x3000, 0x9FFF) ||
          cp.between?(0xF900, 0xFAFF) ||
          cp.between?(0xFF00, 0xFFEF)
      end

      # --- Bubble drawing ---

      def draw_bubble(x, y, w, h, type, on_right)
        @sdl_renderer.draw_blend_mode = SDL2::BlendMode::BLEND

        # Stroke first (behind fill, matching Scratch's stroke→fill order)
        @sdl_renderer.draw_color = STROKE_COLOR
        draw_rounded_rect(x, y, w, h, CORNER_RADIUS)

        # Fill over stroke
        inset = STROKE_WIDTH / 2
        @sdl_renderer.draw_color = FILL_COLOR
        draw_rounded_rect(x + inset, y + inset,
          w - STROKE_WIDTH, h - STROKE_WIDTH,
          [CORNER_RADIUS - inset, 1].max)

        # Tail below bubble, on the side facing the sprite
        # In Scratch: tail is at bottom, pointing toward sprite
        # on_right=true means bubble is right of sprite → tail points left (toward sprite)
        # on_right=false means bubble is left of sprite → tail points right (toward sprite)
        draw_tail(x, y, w, h, type, on_right)
      end

      def draw_rounded_rect(x, y, w, h, r)
        r = [r, w / 2, h / 2].min
        @sdl_renderer.fill_rect(SDL2::Rect.new(x + r, y, w - 2 * r, h))
        @sdl_renderer.fill_rect(SDL2::Rect.new(x, y + r, r, h - 2 * r))
        @sdl_renderer.fill_rect(SDL2::Rect.new(x + w - r, y + r, r, h - 2 * r))
        fill_circle(x + r, y + r, r)
        fill_circle(x + w - r - 1, y + r, r)
        fill_circle(x + r, y + h - r - 1, r)
        fill_circle(x + w - r - 1, y + h - r - 1, r)
      end

      def fill_circle(cx, cy, r)
        r2 = r * r
        (-r..r).each do |dy|
          dx = Math.sqrt([r2 - dy * dy, 0].max).to_i
          @sdl_renderer.draw_line(cx - dx, cy + dy, cx + dx, cy + dy)
        end
      end

      def draw_tail(x, y, w, h, type, on_right)
        # Scratch draws tail at (paddedWidth - CORNER_RADIUS, paddedHeight)
        # = near the RIGHT-BOTTOM corner of the bubble.
        # When pointsLeft (=on_right), the entire canvas is flipped horizontally,
        # so the tail appears at the LEFT-BOTTOM corner.
        #
        # We simulate the flip by choosing tail_x:
        # on_right (pointsLeft): tail at LEFT side → origin near left-bottom
        # !on_right: tail at RIGHT side → origin near right-bottom
        if on_right
          # Tail origin at left side, tail extends further left toward sprite
          tail_x = x + CORNER_RADIUS
          tail_y = y + h - 1
          draw_tail_shape(tail_x, tail_y, -1, type)
        else
          # Tail origin at right side, tail extends further right toward sprite
          tail_x = x + w - CORNER_RADIUS
          tail_y = y + h - 1
          draw_tail_shape(tail_x, tail_y, 1, type)
        end
      end

      def draw_tail_shape(tx, ty, dir, type)
        if type == :say
          draw_say_tail(tx, ty, dir)
        else
          draw_think_tail(tx, ty, dir)
        end
      end

      def draw_say_tail(tx, ty, dir)
        # Scratch say tail path (relative to origin at bubble's bottom-right corner):
        #   (0,0) → bezier to (4,10) → arc tip at ~(3,12) → bezier back to (-16,0)
        #
        # Shape: wide at top (y=0, spans -16..0), narrows to tip at bottom (y≈12).
        # The RIGHT edge goes from x=0 out to x≈4 then back to x≈0 (the tip).
        # The LEFT edge goes from x=-16 at top, curving to x≈-1 at bottom (the tip).
        #
        # Approximation: at each scanline dy, interpolate edges.
        # Left edge: starts at -16 (top), curves to ~0 (bottom tip)
        # Right edge: starts at 0 (top), bulges to ~4 mid-way, returns to ~0 at tip

        @sdl_renderer.draw_color = FILL_COLOR
        (0..TAIL_HEIGHT).each do |dy|
          t = dy.to_f / TAIL_HEIGHT
          left_x = (-16.0 * (1 - t)).to_i
          right_x = (4.0 * Math.sin((1 - t) * Math::PI * 0.6)).to_i
          x1 = tx + dir * left_x
          x2 = tx + dir * right_x
          x1, x2 = x2, x1 if x1 > x2
          @sdl_renderer.draw_line(x1, ty + dy, x2, ty + dy)
        end

        @sdl_renderer.draw_color = STROKE_COLOR
        (0..TAIL_HEIGHT).each do |dy|
          t = dy.to_f / TAIL_HEIGHT
          left_x = (-16.0 * (1 - t)).to_i
          right_x = (4.0 * Math.sin((1 - t) * Math::PI * 0.6)).to_i
          @sdl_renderer.draw_point(tx + dir * left_x, ty + dy)
          @sdl_renderer.draw_point(tx + dir * right_x, ty + dy)
        end
      end

      def draw_think_tail(tx, ty, dir)
        # Scratch's think tail (coords relative to bubble bottom-right corner):
        #   Half-circle at (-16, 0) r=4 — attached to bubble bottom
        #   Circle at (-9.25, 7.25) r=2.25 — middle
        #   Circle at (-1.5, 9.5) r=1.5 — smallest, furthest down
        # Note: positive Y = downward (toward sprite)
        bubbles = [
          [tx + dir * -16, ty + 1, 4],    # Largest, attached to bubble
          [tx + dir * -9, ty + 7, 2],     # Medium
          [tx + dir * -2, ty + 10, 1]     # Smallest, furthest from bubble
        ]
        bubbles.each do |cx, cy, r|
          @sdl_renderer.draw_color = STROKE_COLOR
          fill_circle(cx, cy, r + 1)
          @sdl_renderer.draw_color = FILL_COLOR
          fill_circle(cx, cy, r)
        end
      end

      # --- Text rendering ---

      def draw_lines(lines, bx, by)
        tx = bx + STROKE_WIDTH / 2 + PADDING
        ty = by + STROKE_WIDTH / 2 + PADDING

        lines.each_with_index do |line, i|
          next if line.empty?

          surface = @font.render_blended(line, TEXT_COLOR)
          next unless surface

          texture = @sdl_renderer.create_texture_from(surface)
          texture.blend_mode = SDL2::BlendMode::BLEND
          dst = SDL2::Rect.new(tx, ty + i * LINE_HEIGHT, surface.w, surface.h)
          @sdl_renderer.copy(texture, nil, dst)
          texture.destroy
          surface.destroy
        end
      end

      # --- Positioning (matching Scratch's _positionBubble) ---

      def calc_position(sprite, bw, bh, sw, sh)
        costume = sprite.current_costume_obj
        scale = sprite.size / 100.0
        br = costume ? (costume.bitmap_resolution || 1) : 1

        if costume
          cw = costume.display_width * scale
          rcx = (costume.rotation_center_x || costume.width / 2).to_f / br
          rcy = (costume.rotation_center_y || costume.height / 2).to_f / br
        else
          cw = 40.0
          rcx = rcy = 20.0
        end

        # Sprite bounds in screen coords
        scr_x = (sw / 2 + sprite.x - rcx * scale).to_i
        scr_y = (sh / 2 - sprite.y - rcy * scale).to_i
        s_right = scr_x + cw.to_i
        s_left = scr_x
        s_top = scr_y

        total_h = bh + TAIL_HEIGHT

        # Remember side preference per sprite (like Scratch's bubbleState.onSpriteRight)
        sid = sprite.object_id
        on_right = @on_right.fetch(sid, true)

        # Flip logic matching Scratch
        if on_right && s_right + bw > sw && s_left - bw >= 0
          on_right = false
        elsif !on_right && s_left - bw < 0 && s_right + bw <= sw
          on_right = true
        end
        @on_right[sid] = on_right

        # X position
        bx = if on_right
          s_right.clamp(0, [sw - bw, 0].max)
        else
          (s_left - bw).clamp(0, [sw - bw, 0].max)
        end

        # Y: above sprite top
        by = s_top - total_h
        by = by.clamp(0, [sh - total_h, 0].max)

        [bx, by, on_right]
      end
    end
  end
end
