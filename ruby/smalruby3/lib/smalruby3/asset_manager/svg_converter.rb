# frozen_string_literal: true

require "tempfile"
require "open3"

module Smalruby3
  class AssetManager
    # Converts SVG files to PNG using rsvg-convert CLI.
    module SvgConverter
      RSVG_CONVERT = "rsvg-convert"

      # Check if rsvg-convert is installed and usable.
      def self.available?
        return @available unless @available.nil?
        @available = begin
          _out, status = Open3.capture2e(RSVG_CONVERT, "--version")
          status.success?
        rescue Errno::ENOENT
          false
        end
      end

      # Convert an SVG file to PNG. Returns the output path on success, nil on failure.
      # Uses Array form of Open3 to prevent command injection.
      def self.convert(svg_path, png_path)
        return nil unless File.exist?(svg_path)
        return nil unless available?

        _out, status = Open3.capture2e(
          RSVG_CONVERT,
          "--format", "png",
          "--output", png_path,
          svg_path
        )
        return nil unless status.success?
        return nil unless File.exist?(png_path) && File.size(png_path) > 0

        png_path
      end

      # Return the PNG equivalent md5ext for an SVG md5ext.
      # Returns nil if the input is not an SVG.
      def self.png_path_for(md5ext)
        return nil unless md5ext.is_a?(String) && md5ext.end_with?(".svg")
        md5ext.sub(/\.svg\z/, ".png")
      end
    end
  end
end
