# frozen_string_literal: true

require "sdl2"

module Smalruby3
  module Render
    class Renderer
      attr_reader :width, :height

      def initialize(width, height)
        @width = width
        @height = height
        SDL2.init(SDL2::INIT_VIDEO)
        @window = SDL2::Window.create(
          "Smalruby3",
          SDL2::Window::POS_CENTERED, SDL2::Window::POS_CENTERED,
          width, height, 0
        )
        @sdl_renderer = @window.create_renderer(-1, SDL2::Renderer::Flags::ACCELERATED)
        @textures = {}
      end

      def poll_events
        while (event = SDL2::Event.poll)
          case event
          when SDL2::Event::Quit
            yield :quit
          when SDL2::Event::KeyDown
            yield [:key_down, event.scancode] unless event.repeat
          when SDL2::Event::KeyUp
            yield [:key_up, event.scancode]
          when SDL2::Event::MouseMotion
            yield [:mouse_motion, event.x, event.y]
          when SDL2::Event::MouseButtonDown
            yield [:mouse_button_down]
          when SDL2::Event::MouseButtonUp
            yield [:mouse_button_up]
          end
        end
      end

      def begin_frame
        @sdl_renderer.draw_color = [255, 255, 255, 255]
        @sdl_renderer.clear
      end

      def draw_stage(stage)
        # TODO: Draw backdrop
      end

      def draw_sprite(sprite)
        costume = sprite.instance_variable_get(:@costumes)&.dig(
          sprite.instance_variable_get(:@current_costume)
        )
        return unless costume

        texture = get_texture(costume)
        return unless texture

        # Convert Scratch coords (center origin, +Y up) to SDL2 coords (top-left, +Y down)
        scale = sprite.size / 100.0
        w = (costume.width * scale).to_i
        h = (costume.height * scale).to_i
        cx = costume.rotation_center_x || costume.width / 2
        cy = costume.rotation_center_y || costume.height / 2

        screen_x = (@width / 2 + sprite.x - cx * scale).to_i
        screen_y = (@height / 2 - sprite.y - cy * scale).to_i

        dst = SDL2::Rect.new(screen_x, screen_y, w, h)
        center = SDL2::Point.new((cx * scale).to_i, (cy * scale).to_i)
        angle = sprite.direction - 90  # Scratch: 90=right=0deg in SDL

        @sdl_renderer.copy_ex(texture, nil, dst, angle, center, SDL2::Renderer::FLIP_NONE)
      end

      def end_frame
        @sdl_renderer.present
      end

      def destroy
        @textures.each_value { |t| t.destroy rescue nil }
        @textures.clear
        @window&.destroy
      end

      private

      def get_texture(costume)
        @textures[costume.path] ||= begin
          surface = costume.surface
          return nil unless surface
          @sdl_renderer.create_texture_from(surface)
        end
      end
    end
  end
end
