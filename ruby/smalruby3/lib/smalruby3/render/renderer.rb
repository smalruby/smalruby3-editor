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
        @text_bubble = nil
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
            if event.scancode == SDL2::Key::Scan::ESCAPE
              yield :quit
            elsif !event.repeat
              yield [:key_down, event.scancode]
            end
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
        costume = stage.current_backdrop_obj
        return unless costume

        texture = get_texture(costume)
        return unless texture

        w = costume.display_width.to_i
        h = costume.display_height.to_i

        # Center the backdrop on stage
        screen_x = ((@width - w) / 2).to_i
        screen_y = ((@height - h) / 2).to_i

        dst = SDL2::Rect.new(screen_x, screen_y, w, h)
        @sdl_renderer.copy(texture, nil, dst)
      end

      def draw_sprite(sprite)
        costume = sprite.current_costume_obj
        return unless costume

        # Use effect-applied texture if non-ghost effects are active
        texture = get_effect_texture(sprite, costume)
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
      end

      def draw_bubbles(sprites)
        sprites.each do |sprite|
          next unless sprite.visible
          next unless sprite.say_text || sprite.think_text
          text_bubble.draw(sprite, @width, @height)
        end
      end

      def end_frame
        maybe_save_screenshot
        @sdl_renderer.present
        @frame_count += 1
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
        @text_bubble&.destroy
        @window&.destroy
      end

      private

      def text_bubble
        @text_bubble ||= TextBubble.new(@sdl_renderer)
      end

      def get_effect_texture(sprite, costume)
        if EffectSurface.needs_effects?(sprite.effects)
          surface = EffectSurface.apply(sprite)
          return nil unless surface
          # Effect textures use a per-sprite cache key
          cache_key = :"_effect_tex_#{sprite.object_id}"
          cache = @textures[cache_key]
          effects_hash = sprite.effects.hash ^ costume.path.hash
          if cache && cache[:hash] == effects_hash
            cache[:texture]
          else
            cache&.dig(:texture)&.destroy rescue nil # rubocop:disable Style/RescueModifier
            tex = @sdl_renderer.create_texture_from(surface)
            @textures[cache_key] = {texture: tex, hash: effects_hash}
            tex
          end
        else
          get_texture(costume)
        end
      end

      def get_texture(costume)
        @textures[costume.path] ||= begin
          surface = costume.surface
          return nil unless surface
          @sdl_renderer.create_texture_from(surface)
        end
      end

      # --- Screenshot capture (read_pixels based) ---
      # Reads pixels directly from the SDL2 renderer, capturing
      # everything drawn in the current frame including text bubbles,
      # monitors, and other renderer-drawn elements.

      def maybe_save_screenshot
        return unless @screenshot_at_frame
        return unless @frame_count == @screenshot_at_frame
        return unless @screenshot_path && !File.symlink?(@screenshot_path)

        require "smalruby3/smalruby3_imageutil"
        # read_pixels returns ARGB8888 (little-endian: BGRA bytes)
        argb_data = @sdl_renderer.read_pixels(nil, 0)
        # Convert BGRA → RGBA for PNG encoding
        rgba_data = convert_bgra_to_rgba(argb_data)
        Smalruby3::ImageUtil.save_png(rgba_data, @width, @height, @screenshot_path)
        warn "[Smalruby3] Screenshot saved to #{@screenshot_path} (frame #{@frame_count})"
        @screenshot_at_frame = nil
      rescue => e
        warn "[Smalruby3] Screenshot failed: #{e.message}"
        @screenshot_at_frame = nil
      end

      def convert_bgra_to_rgba(bgra)
        rgba = bgra.dup
        i = 0
        len = rgba.bytesize
        while i < len
          # Swap B and R (bytes 0 and 2)
          b = rgba.getbyte(i)
          rgba.setbyte(i, rgba.getbyte(i + 2))
          rgba.setbyte(i + 2, b)
          i += 4
        end
        rgba
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
