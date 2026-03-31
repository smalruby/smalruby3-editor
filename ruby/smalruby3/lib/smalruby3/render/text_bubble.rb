# frozen_string_literal: true

require "sdl2"
require_relative "font_support"
require_relative "text_bubble/text_wrapper"
require_relative "text_bubble/bubble_drawer"

module Smalruby3
  module Render
    # Renders say/think speech bubbles matching Scratch's TextBubbleSkin.
    # Draws directly via SDL2 renderer (not surface-based).
    class TextBubble
      include FontSupport
      include TextWrapper
      include BubbleDrawer

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
