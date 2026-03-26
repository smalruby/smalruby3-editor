# frozen_string_literal: true

module Smalruby3
  module Render
    class PenSkin
      attr_reader :width, :height

      def initialize(sdl_renderer, width, height)
        @sdl_renderer = sdl_renderer
        @width = width
        @height = height
        @texture = sdl_renderer.create_texture(
          SDL2::PixelFormat::RGBA8888,
          SDL2::Texture::ACCESS_TARGET,
          width, height
        )
        @texture.blend_mode = SDL2::BlendMode::BLEND
        clear
      end

      def clear
        old_target = @sdl_renderer.render_target
        @sdl_renderer.render_target = @texture
        @sdl_renderer.draw_color = [0, 0, 0, 0]
        @sdl_renderer.clear
        @sdl_renderer.render_target = old_target
      end

      def draw_line(x1, y1, x2, y2, color, size)
        old_target = @sdl_renderer.render_target
        @sdl_renderer.render_target = @texture
        @sdl_renderer.draw_color = color

        if size <= 1
          @sdl_renderer.draw_line(x1, y1, x2, y2)
        else
          # Draw thick line using multiple parallel lines
          half = size / 2.0
          dx = x2 - x1
          dy = y2 - y1
          len = Math.sqrt(dx * dx + dy * dy)
          if len > 0
            nx = -dy / len * half
            ny = dx / len * half
            (-half.ceil..half.ceil).each do |offset|
              ox = (nx * offset / half).round
              oy = (ny * offset / half).round
              @sdl_renderer.draw_line(x1 + ox, y1 + oy, x2 + ox, y2 + oy)
            end
          else
            @sdl_renderer.fill_rect(SDL2::Rect.new(
              (x1 - half).to_i, (y1 - half).to_i, size.to_i, size.to_i
            ))
          end
        end

        @sdl_renderer.render_target = old_target
      end

      def stamp(texture, dst_rect, angle, center)
        old_target = @sdl_renderer.render_target
        @sdl_renderer.render_target = @texture
        @sdl_renderer.copy_ex(texture, nil, dst_rect, angle, center, SDL2::Renderer::FLIP_NONE)
        @sdl_renderer.render_target = old_target
      end

      def render_to(sdl_renderer)
        sdl_renderer.copy(@texture, nil, nil)
      end

      def destroy
        @texture&.destroy
      end
    end
  end
end
