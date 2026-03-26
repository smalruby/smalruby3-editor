# frozen_string_literal: true

require "sdl2"

module Smalruby3
  module Render
    class Renderer
      attr_reader :width, :height

      def initialize(width, height)
        @width = width
        @height = height
        @frame_count = 0
        @screenshot_at_frame = ENV["SMALRUBY3_SCREENSHOT"]&.to_i
        @screenshot_path = validate_screenshot_path(
          ENV.fetch("SMALRUBY3_SCREENSHOT_PATH", "/tmp/smalruby3_screenshot.png")
        )
        SDL2.init(SDL2::INIT_VIDEO)
        @window = SDL2::Window.create(
          "Smalruby3",
          SDL2::Window::POS_CENTERED, SDL2::Window::POS_CENTERED,
          width, height, 0
        )
        @sdl_renderer = @window.create_renderer(-1, SDL2::Renderer::Flags::ACCELERATED)
        @textures = {}
        @pen_skin = nil
        @capture_surface = nil
        @window.show
        @window.raise
      end

      def pen_skin
        @pen_skin ||= PenSkin.new(@sdl_renderer, @width, @height)
      end

      def pen_draw_line(x1, y1, x2, y2, color, size)
        pen_skin.draw_line(x1, y1, x2, y2, color, size)
      end

      def stamp_sprite(sprite)
        costume = sprite.current_costume_obj
        return unless costume
        texture = get_texture(costume)
        return unless texture

        br = costume.bitmap_resolution || 1
        scale = sprite.size / 100.0
        w = (costume.display_width * scale).to_i
        h = (costume.display_height * scale).to_i
        cx = (costume.rotation_center_x || costume.width / 2).to_f / br
        cy = (costume.rotation_center_y || costume.height / 2).to_f / br
        screen_x = (@width / 2 + sprite.x - cx * scale).to_i
        screen_y = (@height / 2 - sprite.y - cy * scale).to_i
        dst = SDL2::Rect.new(screen_x, screen_y, w, h)
        center = SDL2::Point.new((cx * scale).to_i, (cy * scale).to_i)
        angle = sprite.direction - 90
        pen_skin.stamp(texture, dst, angle, center)
      end

      def remove_sprite(_sprite)
        # Cleanup if needed
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

        if capturing?
          init_capture_surface
        end
      end

      def draw_stage(_stage)
        # Stage background is white (already cleared to white in begin_frame)
      end

      def draw_sprite(sprite)
        costume = sprite.current_costume_obj
        return unless costume

        texture = get_texture(costume)
        return unless texture

        # Convert Scratch coords (center origin, +Y up) to SDL2 coords (top-left, +Y down)
        br = costume.bitmap_resolution || 1
        scale = sprite.size / 100.0
        w = (costume.display_width * scale).to_i
        h = (costume.display_height * scale).to_i
        cx = (costume.rotation_center_x || costume.width / 2).to_f / br
        cy = (costume.rotation_center_y || costume.height / 2).to_f / br

        screen_x = (@width / 2 + sprite.x - cx * scale).to_i
        screen_y = (@height / 2 - sprite.y - cy * scale).to_i

        dst = SDL2::Rect.new(screen_x, screen_y, w, h)
        center = SDL2::Point.new((cx * scale).to_i, (cy * scale).to_i)
        angle = sprite.direction - 90 # Scratch: 90=right=0deg in SDL

        # Apply ghost effect via alpha modulation
        effects = sprite.effects
        if effects["ghost"] && effects["ghost"] != 0
          ghost_val = EffectTransform.convert_effect("ghost", effects["ghost"])
          texture.alpha_mod = (ghost_val * 255).round.clamp(0, 255)
        else
          texture.alpha_mod = 255
        end

        texture.blend_mode = SDL2::BlendMode::BLEND
        @sdl_renderer.copy_ex(texture, nil, dst, angle, center, SDL2::Renderer::FLIP_NONE)

        # Also blit to capture surface for screenshot
        if capturing? && @capture_surface
          blit_to_capture(costume.surface, screen_x, screen_y, w, h)
        end
      end

      def end_frame
        @sdl_renderer.present
        @frame_count += 1
        maybe_save_screenshot
      end

      def destroy
        @textures.each_value { |t|
          begin
            t.destroy
          rescue
            nil
          end
        }
        @textures.clear
        @capture_surface&.destroy
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

      # --- Screenshot capture ---

      def capturing?
        @screenshot_at_frame && @frame_count == @screenshot_at_frame - 1
      end

      def maybe_save_screenshot
        return unless @screenshot_at_frame
        return unless @frame_count == @screenshot_at_frame

        if @capture_surface && @screenshot_path && !File.symlink?(@screenshot_path)
          save_surface_as_png(@capture_surface, @screenshot_path)
          warn "[Smalruby3] Screenshot saved to #{@screenshot_path} (frame #{@frame_count})"
          @capture_surface.destroy
          @capture_surface = nil
        end
        @screenshot_at_frame = nil
      end

      def init_capture_surface
        @capture_surface&.destroy
        # Create white surface using from_string
        white_pixel = "\xFF\xFF\xFF\xFF".b
        white_data = (white_pixel * @width * @height)
        @capture_surface = SDL2::Surface.from_string(white_data, @width, @height, 32)
      end

      def blit_to_capture(src_surface, screen_x, screen_y, w, h)
        return unless src_surface && @capture_surface
        src_rect = SDL2::Rect.new(0, 0, src_surface.w, src_surface.h)
        dst_rect = SDL2::Rect.new(screen_x, screen_y, w, h)
        SDL2::Surface.blit(src_surface, src_rect, @capture_surface, dst_rect)
      end

      def save_surface_as_png(surface, path)
        require "smalruby3/smalruby3_resvg"
        # Extract RGBA pixel data from the SDL2 surface
        rgba_data = surface.pixels
        Smalruby3::Resvg.save_png(rgba_data, surface.w, surface.h, path)
      rescue => e
        warn "[Smalruby3] PNG save failed (#{e.message}), falling back to BMP"
        SDL2::Surface.save_bmp(surface, path.sub(/\.png\z/, ".bmp"))
      end

      # Validate screenshot path: must not be a symlink or point outside /tmp
      def validate_screenshot_path(path)
        return nil unless path
        expanded = File.expand_path(path)
        if File.symlink?(path)
          warn "[Smalruby3] Refusing screenshot to symlink: #{path}"
          return nil
        end
        expanded
      end
    end
  end
end
