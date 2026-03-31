# frozen_string_literal: true

module Smalruby3
  module Render
    class TextBubble
      # Bubble shape drawing: rounded rect, tail (say/think), and junction.
      # Requires `@sdl_renderer` to be set before use.
      module BubbleDrawer
        private

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

          # Tail below bubble
          draw_tail(x, y, w, h, type, on_right)

          # Erase the border between bubble and tail by overdrawing
          # the junction area with fill color
          erase_tail_junction(x, y, w, h, on_right, type)
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

        def erase_tail_junction(x, y, w, h, on_right, type)
          return if type == :think # think has detached circles, no junction

          # The say tail top edge (y=0) spans from x=-16 to x=0 relative to tail_x.
          # With dir multiplier, calculate the screen-space range of the junction.
          jw = 16
          jx = if on_right
            # dir=-1: tail_x to tail_x+16
            x + CORNER_RADIUS
          else
            # dir=1: tail_x-16 to tail_x
            x + w - CORNER_RADIUS - 16
          end
          @sdl_renderer.draw_color = FILL_COLOR
          # Erase the border at the junction (bottom of bubble where tail attaches)
          @sdl_renderer.fill_rect(SDL2::Rect.new(jx, y + h - STROKE_WIDTH,
            jw, STROKE_WIDTH + 1))
        end

        def draw_tail(x, y, w, h, type, on_right)
          if on_right
            tail_x = x + CORNER_RADIUS
            tail_y = y + h - 1
            draw_tail_shape(tail_x, tail_y, -1, type)
          else
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
          right_edge = Array.new(TAIL_HEIGHT + 1, 0)
          left_edge = Array.new(TAIL_HEIGHT + 1, 999)

          steps = TAIL_HEIGHT * 8
          (0..steps).each do |i|
            t = i.to_f / steps
            rx = cubic_bezier(t, 0, 0, 4, 4)
            ry = cubic_bezier(t, 0, 4, 8, 10)
            yi = ry.round.clamp(0, TAIL_HEIGHT)
            right_edge[yi] = [right_edge[yi], rx.round].max

            lx = cubic_bezier(t, -16, -11, -1, 2)
            ly = cubic_bezier(t, 0, 8, 12, 12)
            yi = ly.round.clamp(0, TAIL_HEIGHT)
            left_edge[yi] = [left_edge[yi], lx.round].min
          end

          (0..TAIL_HEIGHT).each do |dy|
            left_edge[dy] = [left_edge[dy], right_edge[dy]].min
          end

          # Stroke
          @sdl_renderer.draw_color = STROKE_COLOR
          sw = STROKE_WIDTH / 2
          (0..TAIL_HEIGHT).each do |dy|
            x1 = tx + dir * (left_edge[dy] - sw)
            x2 = tx + dir * (right_edge[dy] + sw)
            x1, x2 = x2, x1 if x1 > x2
            @sdl_renderer.draw_line(x1, ty + dy, x2, ty + dy) if x2 >= x1
          end

          # Fill
          @sdl_renderer.draw_color = FILL_COLOR
          (0..TAIL_HEIGHT).each do |dy|
            x1 = tx + dir * left_edge[dy]
            x2 = tx + dir * right_edge[dy]
            x1, x2 = x2, x1 if x1 > x2
            @sdl_renderer.draw_line(x1, ty + dy, x2, ty + dy) if x2 >= x1
          end
        end

        def cubic_bezier(t, p0, p1, p2, p3)
          mt = 1 - t
          mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3
        end

        def draw_think_tail(tx, ty, dir)
          bubbles = [
            [tx + dir * -16, ty + 1, 4],
            [tx + dir * -9, ty + 7, 2],
            [tx + dir * -2, ty + 10, 1]
          ]
          bubbles.each do |cx, cy, r|
            @sdl_renderer.draw_color = STROKE_COLOR
            fill_circle(cx, cy, r + 1)
            @sdl_renderer.draw_color = FILL_COLOR
            fill_circle(cx, cy, r)
          end
        end
      end
    end
  end
end
