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

      # --- Text wrapping ---

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
        i = 0
        chars = para.chars

        while i < chars.length
          ch = chars[i]
          if cjk?(ch)
            i = try_append_char(ch, current, lines, i)
            current = (lines.last == current) ? ch : (current + ch)
            # Re-read current after potential push
            current = recompute_current(current, ch, lines)
          elsif ch == " "
            word, i = collect_word(chars, i)
            current = try_append_word(word, current, lines)
          else
            word, i = collect_non_space(chars, i)
            current = try_append_word(word, current, lines)
          end
        end
        lines << current unless current.empty?
      end

      def try_append_char(ch, current, lines, i)
        test = current + ch
        w, = @font.size_text(test)
        if w <= MAX_LINE_WIDTH
          # Will be appended by caller
        else
          lines << current unless current.empty?
        end
        i + 1
      end

      def recompute_current(old_current, ch, lines)
        test = old_current + ch
        w, = @font.size_text(test)
        if w <= MAX_LINE_WIDTH
          test
        else
          ch
        end
      end

      def collect_word(chars, i)
        word = " "
        i += 1
        while i < chars.length && chars[i] != " " && !cjk?(chars[i])
          word += chars[i]
          i += 1
        end
        [word, i]
      end

      def collect_non_space(chars, i)
        word = ""
        while i < chars.length && chars[i] != " " && !cjk?(chars[i])
          word += chars[i]
          i += 1
        end
        [word, i]
      end

      def try_append_word(word, current, lines)
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

        # Stroke first (behind fill, matching Scratch order)
        @sdl_renderer.draw_color = STROKE_COLOR
        draw_rounded_rect(x, y, w, h, CORNER_RADIUS)

        # Fill over stroke
        inset = STROKE_WIDTH / 2
        @sdl_renderer.draw_color = FILL_COLOR
        draw_rounded_rect(x + inset, y + inset,
          w - STROKE_WIDTH, h - STROKE_WIDTH,
          [CORNER_RADIUS - inset, 1].max)

        # Tail below bubble
        draw_tail(x, y, w, h, type, on_right)
      end

      def draw_rounded_rect(x, y, w, h, r)
        r = [r, w / 2, h / 2].min
        # Horizontal center
        @sdl_renderer.fill_rect(SDL2::Rect.new(x + r, y, w - 2 * r, h))
        # Vertical sides
        @sdl_renderer.fill_rect(SDL2::Rect.new(x, y + r, r, h - 2 * r))
        @sdl_renderer.fill_rect(SDL2::Rect.new(x + w - r, y + r, r, h - 2 * r))
        # 4 corner quarter-circles
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
        tail_x = on_right ? (x + CORNER_RADIUS + 4) : (x + w - CORNER_RADIUS - 4)
        tail_y = y + h

        if type == :say
          draw_say_tail(tail_x, tail_y, on_right)
        else
          draw_think_tail(tail_x, tail_y, on_right)
        end
      end

      def draw_say_tail(tx, ty, on_right)
        dir = on_right ? 1 : -1
        # Fill
        @sdl_renderer.draw_color = FILL_COLOR
        (0...TAIL_HEIGHT).each do |dy|
          t = dy.to_f / TAIL_HEIGHT
          x1 = tx + (dir * (-16 * t)).to_i
          x2 = tx + (dir * (4 * (1 - t))).to_i
          x1, x2 = x2, x1 if x1 > x2
          @sdl_renderer.draw_line(x1, ty + dy, x2, ty + dy)
        end
        # Outline
        @sdl_renderer.draw_color = STROKE_COLOR
        (0...TAIL_HEIGHT).each do |dy|
          t = dy.to_f / TAIL_HEIGHT
          @sdl_renderer.draw_point(tx + (dir * (-16 * t)).to_i, ty + dy)
          @sdl_renderer.draw_point(tx + (dir * (4 * (1 - t))).to_i, ty + dy)
        end
      end

      def draw_think_tail(tx, ty, on_right)
        dir = on_right ? 1 : -1
        bubbles = [
          [tx + dir * -8, ty + 2, 4],
          [tx + dir * -3, ty + 7, 2],
          [tx + dir * 1, ty + 10, 1]
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
          costume.display_height
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

        # Default: right side
        on_right = true
        bx = s_right

        # Flip to left if right overflows and left has space
        if bx + bw > sw && s_left - bw >= 0
          on_right = false
          bx = s_left - bw
        end
        bx = bx.clamp(0, [sw - bw, 0].max)

        # Y: above sprite
        by = s_top - total_h
        by = by.clamp(0, [sh - total_h, 0].max)

        [bx, by, on_right]
      end
    end
  end
end
