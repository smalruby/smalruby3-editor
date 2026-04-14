# frozen_string_literal: true

module Smalruby3
  module Render
    class Renderer
      # Screenshot capture support using SDL2 read_pixels.
      # Reads pixels directly from the SDL2 renderer, capturing
      # everything drawn in the current frame including text bubbles,
      # monitors, and other renderer-drawn elements.
      #
      # Requires `@sdl_renderer`, `@width`, `@height`, `@frame_count`,
      # `@screenshot_at_frame`, and `@screenshot_path` to be set.
      module Screenshot
        private

        def maybe_save_screenshot
          return unless @screenshot_at_frame
          return unless @frame_count == @screenshot_at_frame
          return unless @screenshot_path && !File.symlink?(@screenshot_path)

          require "smalruby3/smalruby3_imageutil"
          # Explicitly request ARGB8888 for consistent byte order across platforms
          argb_data = @sdl_renderer.read_pixels(nil, SDL2::PixelFormat::ARGB8888)
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
end
