# frozen_string_literal: true

require "json"
require "fileutils"

module Smalruby3
  class AssetManager
    # md5ext must be hex hash + dot + lowercase extension
    SAFE_MD5EXT = /\A[a-f0-9]+\.(png|svg|wav|mp3|jpg)\z/

    def initialize
      @cache_dir = File.join(Smalruby3.home, "cache", "assets")
      @catalog = load_catalog
      FileUtils.mkdir_p(@cache_dir)
    end

    def resolve_costumes(sprite_name)
      sprite_data = @catalog.dig("sprites", sprite_name)
      return [] unless sprite_data

      sprite_data["costumes"].map { |c|
        path = resolve_asset(c["md5ext"], c["rawURL"])
        Costume.new(
          name: c["name"], path: path,
          rotation_center_x: c["rotationCenterX"],
          rotation_center_y: c["rotationCenterY"],
          bitmap_resolution: c["bitmapResolution"] || 1
        )
      }
    end

    def resolve_costumes_by_name(costume_names)
      costume_names.filter_map { |name|
        data = find_costume_in_catalog(name)
        next unless data
        path = resolve_asset(data["md5ext"], data["rawURL"])
        Costume.new(
          name: data["name"], path: path,
          rotation_center_x: data["rotationCenterX"],
          rotation_center_y: data["rotationCenterY"],
          bitmap_resolution: data["bitmapResolution"] || 1
        )
      }
    end

    def resolve_sounds(sprite_name)
      sprite_data = @catalog.dig("sprites", sprite_name)
      return [] unless sprite_data

      sprite_data["sounds"].filter_map { |s|
        path = resolve_asset(s["md5ext"])
        path ? Sound.new(name: s["name"], path: path) : nil
      }
    end

    def resolve_sounds_by_name(sound_names)
      sound_names.filter_map { |name|
        data = find_sound_in_catalog(name)
        next unless data
        path = resolve_asset(data["md5ext"])
        path ? Sound.new(name: data["name"], path: path) : nil
      }
    end

    def resolve_backdrops(backdrop_names)
      backdrop_names.filter_map { |name|
        data = @catalog.dig("backdrops", name)
        next unless data
        path = resolve_asset(data["md5ext"], data["rawURL"])
        Costume.new(
          name: name, path: path,
          rotation_center_x: data["rotationCenterX"],
          rotation_center_y: data["rotationCenterY"],
          bitmap_resolution: data["bitmapResolution"] || 1
        )
      }
    end

    def prefetch_all(sprite_classes, stage_class)
      collect_required_assets(sprite_classes, stage_class).each do |md5ext, raw_url|
        resolve_asset(md5ext, raw_url)
      end
    end

    private

    def load_catalog
      catalog_path = File.expand_path("asset_catalog.json", __dir__)
      if File.exist?(catalog_path)
        JSON.parse(File.read(catalog_path))
      else
        {"sprites" => {}, "backdrops" => {}}
      end
    end

    def resolve_asset(md5ext, raw_url = nil)
      return nil unless valid_md5ext?(md5ext)

      preset_path = find_preset(md5ext)
      return maybe_convert_svg(preset_path, md5ext) if preset_path

      cache_path = safe_cache_path(md5ext)
      return nil unless cache_path

      # Check for already-converted PNG in cache
      png_md5ext = SvgConverter.png_path_for(md5ext)
      if png_md5ext
        png_cache = safe_cache_path(png_md5ext)
        return png_cache if png_cache && regular_file?(png_cache)
      end

      return maybe_convert_svg(cache_path, md5ext) if regular_file?(cache_path)

      downloaded = download_asset(md5ext, raw_url, cache_path)
      return nil unless downloaded
      maybe_convert_svg(downloaded, md5ext)
    end

    def find_preset(md5ext)
      preset_dir = File.expand_path("../../assets/preset", __dir__)
      path = File.join(preset_dir, md5ext)
      resolved = File.expand_path(path)
      return nil unless resolved.start_with?("#{File.expand_path(preset_dir)}/")
      regular_file?(resolved) ? resolved : nil
    end

    def valid_md5ext?(md5ext)
      md5ext.is_a?(String) && md5ext.match?(SAFE_MD5EXT)
    end

    def safe_cache_path(md5ext)
      path = File.join(@cache_dir, md5ext)
      resolved = File.expand_path(path)
      return nil unless resolved.start_with?("#{File.expand_path(@cache_dir)}/")
      resolved
    end

    def regular_file?(path)
      File.exist?(path) && !File.symlink?(path) && File.file?(path)
    end

    def download_asset(md5ext, raw_url, cache_path)
      url = Downloader.build_download_url(md5ext, raw_url)
      return nil unless url
      Downloader.safe_download(url, cache_path)
    rescue => e
      warn "[Smalruby3] Failed to download asset #{md5ext}: #{e.message}"
      nil
    end

    # Convert SVG to PNG if needed, returning the PNG path. Falls back to original path.
    def maybe_convert_svg(path, md5ext)
      png_md5ext = SvgConverter.png_path_for(md5ext)
      return path unless png_md5ext

      png_cache = safe_cache_path(png_md5ext)
      return path unless png_cache
      return png_cache if regular_file?(png_cache)

      converted = SvgConverter.convert(path, png_cache)
      converted || path
    end

    def find_costume_in_catalog(name)
      @catalog["sprites"].each_value do |sprite_data|
        sprite_data["costumes"].each { |c| return c if c["name"] == name }
      end
      nil
    end

    def find_sound_in_catalog(name)
      @catalog["sprites"].each_value do |sprite_data|
        sprite_data["sounds"].each { |s| return s if s["name"] == name }
      end
      nil
    end

    def collect_required_assets(sprite_classes, stage_class)
      assets = {}
      sprite_classes.each { |klass| collect_sprite_assets(klass, assets) }
      collect_stage_assets(stage_class, assets) if stage_class
      assets
    end

    def collect_sprite_assets(klass, assets)
      sprite_name = klass._sprite_name
      if sprite_name
        sprite_data = @catalog.dig("sprites", sprite_name)
        if sprite_data
          sprite_data["costumes"].each { |c| assets[c["md5ext"]] = c["rawURL"] }
          sprite_data["sounds"].each { |s| assets[s["md5ext"]] = nil }
        end
      end
      klass._costume_names.each do |name|
        data = find_costume_in_catalog(name)
        assets[data["md5ext"]] = data["rawURL"] if data
      end
      klass._sound_names.each do |name|
        data = find_sound_in_catalog(name)
        assets[data["md5ext"]] = nil if data
      end
    end

    def collect_stage_assets(stage_class, assets)
      stage_class._backdrop_names.each do |name|
        data = @catalog.dig("backdrops", name)
        assets[data["md5ext"]] = data["rawURL"] if data
      end
      stage_class._sound_names.each do |name|
        data = find_sound_in_catalog(name)
        assets[data["md5ext"]] = nil if data
      end
    end
  end
end

require_relative "asset_manager/downloader"
require_relative "asset_manager/svg_converter"
