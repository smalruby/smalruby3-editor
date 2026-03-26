# frozen_string_literal: true

require "sdl2"

module Smalruby3
  module Render
    # Renders say/think speech bubbles for sprites.
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
      FILL_COLOR = [255, 255, 255].freeze   # white
      STROKE_COLOR = [0, 0, 0, 38].freeze   # rgba(0,0,0,0.15)

      def initialize(sdl_renderer)
        @sdl_renderer = sdl_renderer
        @font = nil
        @cache = {} # key: [text, type] => texture, w, h
      end

      def draw(sprite, stage_width, stage_height)
        text = sprite.say_text || sprite.think_text
        return unless text && !text.empty?

        type = sprite.say_text ? :say : :think
        ensure_font

        entry = cached_texture(text, type)
        return unless entry

        texture, bw, bh = entry
        x, y = bubble_position(sprite, bw, bh, stage_width, stage_height)
        dst = SDL2::Rect.new(x, y, bw, bh)
        @sdl_renderer.copy(texture, nil, dst)
      end

      def destroy
        @cache.each_value { |tex, _, _| tex.destroy rescue nil } # rubocop:disable Style/RescueModifier
        @cache.clear
        @font&.destroy
        @font = nil
      end

      private

      def ensure_font
        return if @font

        SDL2::TTF.init unless SDL2::TTF.respond_to?(:init!) # already inited check
        font_path = find_font
        @font = SDL2::TTF.open(font_path, FONT_SIZE) if font_path
      end

      def find_font
        candidates = [
          "/System/Library/Fonts/Helvetica.ttc",
          "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
          "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
          "/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf"
        ]
        candidates.find { |p| File.exist?(p) }
      end

      def cached_texture(text, type)
        key = [text, type]
        return @cache[key] if @cache.key?(key)

        surface = render_bubble(text, type)
        return nil unless surface

        texture = @sdl_renderer.create_texture_from(surface)
        texture.blend_mode = SDL2::BlendMode::BLEND
        w = surface.w
        h = surface.h
        surface.destroy
        @cache[key] = [texture, w, h]
      end

      def render_bubble(text, type)
        return nil unless @font

        truncated = (text.length > MAX_TEXT_LENGTH) ? text[0, MAX_TEXT_LENGTH] : text
        lines = wrap_text(truncated)
        return nil if lines.empty?

        longest_w = lines.map { |l| @font.size_text(l)[0] }.max
        text_w = [longest_w, MIN_WIDTH].max
        text_h = LINE_HEIGHT * lines.size

        bubble_w = text_w + PADDING * 2 + STROKE_WIDTH
        bubble_h = text_h + PADDING * 2 + STROKE_WIDTH + TAIL_HEIGHT

        surface = SDL2::Surface.from_string(
          "\x00\x00\x00\x00" * bubble_w * bubble_h,
          bubble_w, bubble_h, 32
        )

        draw_bubble_shape(surface, bubble_w, bubble_h - TAIL_HEIGHT, type)
        draw_text_lines(surface, lines, bubble_w, bubble_h)

        surface
      end

      def wrap_text(text)
        return [""] if text.empty?
        return [text] unless @font

        lines = []
        text.split("\n").each do |paragraph|
          if paragraph.empty?
            lines << ""
            next
          end

          words = paragraph.split(/(?<=\s)|(?=\s)/)
          current = ""

          words.each do |word|
            test = current.empty? ? word : "#{current}#{word}"
            w, = @font.size_text(test)
            if w <= MAX_LINE_WIDTH
              current = test
            else
              lines << current unless current.empty?
              current = word.lstrip
            end
          end
          lines << current unless current.empty?
        end

        lines.empty? ? [""] : lines
      end

      def draw_bubble_shape(surface, w, h, _type)
        # Fill white rounded rectangle
        fill_rect(surface, STROKE_WIDTH / 2, STROKE_WIDTH / 2,
          w - STROKE_WIDTH, h - STROKE_WIDTH,
          FILL_COLOR[0], FILL_COLOR[1], FILL_COLOR[2], 255)

        # Simple border (top, bottom, left, right lines)
        draw_border(surface, 0, 0, w, h,
          STROKE_COLOR[0], STROKE_COLOR[1], STROKE_COLOR[2], STROKE_COLOR[3])
      end

      def fill_rect(surface, x, y, w, h, r, g, b, a)
        pixels = surface.pixels
        pitch = surface.pitch
        bpp = pitch / surface.w

        y_start = [y, 0].max
        y_end = [y + h, surface.h].min
        x_start = [x, 0].max
        x_end = [x + w, surface.w].min

        (y_start...y_end).each do |py|
          (x_start...x_end).each do |px|
            offset = py * pitch + px * bpp
            pixels.setbyte(offset, r)
            pixels.setbyte(offset + 1, g)
            pixels.setbyte(offset + 2, b)
            pixels.setbyte(offset + 3, a)
          end
        end
      end

      def draw_border(surface, x, y, w, h, r, g, b, a)
        # Top and bottom borders
        fill_rect(surface, x, y, w, STROKE_WIDTH / 2, r, g, b, a)
        fill_rect(surface, x, y + h - STROKE_WIDTH / 2, w, STROKE_WIDTH / 2, r, g, b, a)
        # Left and right borders
        fill_rect(surface, x, y, STROKE_WIDTH / 2, h, r, g, b, a)
        fill_rect(surface, x + w - STROKE_WIDTH / 2, y, STROKE_WIDTH / 2, h, r, g, b, a)
      end

      def draw_text_lines(surface, lines, bubble_w, bubble_h)
        text_start_x = (STROKE_WIDTH / 2) + PADDING
        text_start_y = (STROKE_WIDTH / 2) + PADDING

        lines.each_with_index do |line, i|
          next if line.empty?

          text_surface = @font.render_blended(line, TEXT_COLOR)
          next unless text_surface

          src = SDL2::Rect.new(0, 0, text_surface.w, text_surface.h)
          dst = SDL2::Rect.new(text_start_x, text_start_y + i * LINE_HEIGHT,
            text_surface.w, text_surface.h)
          SDL2::Surface.blit(text_surface, src, surface, dst)
          text_surface.destroy
        end
      end

      def bubble_position(sprite, bw, bh, stage_width, stage_height)
        costume = sprite.current_costume_obj
        scale = sprite.size / 100.0
        sprite_hw = costume ? (costume.display_width * scale / 2).to_i : 20
        sprite_hh = costume ? (costume.display_height * scale / 2).to_i : 20

        # Sprite screen position (center)
        center_x = stage_width / 2 + sprite.x
        center_y = stage_height / 2 - sprite.y

        # Try right side
        x = (center_x + sprite_hw + 4).to_i
        y = (center_y - sprite_hh - bh + 8).to_i

        # Clamp to stage bounds
        x = x.clamp(0, stage_width - bw)
        y = y.clamp(0, stage_height - bh)

        # Flip to left if overflow on right
        if x + bw > stage_width
          x = (center_x - sprite_hw - bw - 4).to_i
          x = [0, x].max
        end

        [x, y]
      end
    end
  end
end
