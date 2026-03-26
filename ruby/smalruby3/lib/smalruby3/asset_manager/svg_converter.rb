# frozen_string_literal: true

require_relative "../smalruby3_resvg"

module Smalruby3
  class AssetManager
    # Converts SVG files to PNG using the built-in Rust resvg extension.
    module SvgConverter
      # Always available — the Rust extension is bundled with the gem.
      def self.available?
        true
      end

      # Convert an SVG file to PNG. Returns the output path on success, nil on failure.
      def self.convert(svg_path, png_path)
        return nil unless File.exist?(svg_path)

        Smalruby3::ImageUtil.convert_svg_to_png(svg_path, png_path)
        return nil unless File.exist?(png_path) && File.size(png_path) > 0

        png_path
      rescue => e
        warn "[Smalruby3] SVG conversion failed: #{e.message}"
        nil
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
