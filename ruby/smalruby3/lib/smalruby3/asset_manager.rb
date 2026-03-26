# frozen_string_literal: true

require "json"
require "net/http"
require "uri"
require "fileutils"

module Smalruby3
  class AssetManager
    CACHE_DIR = File.join(Dir.home, ".cache", "smalruby3", "assets")
    SCRATCH_ASSET_URL = "https://assets.scratch.mit.edu/internalapi/asset/%{md5ext}/get/"
    SMALRUBY_ASSET_BASE_URL = "https://smalruby.app/"

    def initialize
      @catalog = load_catalog
      FileUtils.mkdir_p(CACHE_DIR)
    end

    # Resolve costumes for a sprite by sprite library name.
    # Returns an array of Costume objects.
    def resolve_costumes(sprite_name)
      sprite_data = @catalog.dig("sprites", sprite_name)
      return [] unless sprite_data

      sprite_data["costumes"].map { |c|
        path = resolve_asset(c["md5ext"], c["rawURL"])
        Costume.new(
          name: c["name"],
          path: path,
          rotation_center_x: c["rotationCenterX"],
          rotation_center_y: c["rotationCenterY"],
          bitmap_resolution: c["bitmapResolution"] || 1
        )
      }
    end

    # Resolve costumes by individual costume names (from set_costumes DSL).
    def resolve_costumes_by_name(costume_names)
      costume_names.filter_map { |name|
        data = find_costume_in_catalog(name)
        next unless data

        path = resolve_asset(data["md5ext"], data["rawURL"])
        Costume.new(
          name: data["name"],
          path: path,
          rotation_center_x: data["rotationCenterX"],
          rotation_center_y: data["rotationCenterY"],
          bitmap_resolution: data["bitmapResolution"] || 1
        )
      }
    end

    # Resolve sounds for a sprite by sprite library name.
    def resolve_sounds(sprite_name)
      sprite_data = @catalog.dig("sprites", sprite_name)
      return [] unless sprite_data

      sprite_data["sounds"].filter_map { |s|
        path = resolve_asset(s["md5ext"])
        path ? Sound.new(name: s["name"], path: path) : nil
      }
    end

    # Resolve sounds by individual sound names (from set_sounds DSL).
    def resolve_sounds_by_name(sound_names)
      sound_names.filter_map { |name|
        data = find_sound_in_catalog(name)
        next unless data

        path = resolve_asset(data["md5ext"])
        path ? Sound.new(name: data["name"], path: path) : nil
      }
    end

    # Resolve backdrops by name list (from set_backdrops DSL).
    def resolve_backdrops(backdrop_names)
      backdrop_names.filter_map { |name|
        data = @catalog.dig("backdrops", name)
        next unless data

        path = resolve_asset(data["md5ext"], data["rawURL"])
        Costume.new(
          name: name,
          path: path,
          rotation_center_x: data["rotationCenterX"],
          rotation_center_y: data["rotationCenterY"],
          bitmap_resolution: data["bitmapResolution"] || 1
        )
      }
    end

    # Download all assets needed by the given targets.
    # Called before execution starts to ensure all assets are available.
    def prefetch_all(sprite_classes, stage_class)
      assets_to_fetch = collect_required_assets(sprite_classes, stage_class)
      assets_to_fetch.each do |md5ext, raw_url|
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

    # Resolve a single asset: check preset → cache → download.
    # Returns the local file path, or nil if unavailable.
    def resolve_asset(md5ext, raw_url = nil)
      # 1. Check preset assets
      preset_path = find_preset(md5ext)
      return preset_path if preset_path

      # 2. Check cache
      cache_path = File.join(CACHE_DIR, md5ext)
      return cache_path if File.exist?(cache_path)

      # 3. Download
      download_asset(md5ext, raw_url, cache_path)
    end

    def find_preset(md5ext)
      preset_dir = File.expand_path("../../assets/preset", __dir__)
      path = File.join(preset_dir, md5ext)
      File.exist?(path) ? path : nil
    end

    def download_asset(md5ext, raw_url, cache_path)
      url = if raw_url
        URI.join(SMALRUBY_ASSET_BASE_URL, raw_url).to_s
      else
        format(SCRATCH_ASSET_URL, md5ext: md5ext)
      end

      download_file(url, cache_path)
    rescue => e
      warn "[Smalruby3] Failed to download asset #{md5ext}: #{e.message}"
      nil
    end

    def download_file(url, dest_path)
      uri = URI.parse(url)
      response = Net::HTTP.get_response(uri)

      # Follow redirects (up to 3)
      3.times do
        break unless response.is_a?(Net::HTTPRedirection)
        uri = URI.parse(response["location"])
        response = Net::HTTP.get_response(uri)
      end

      if response.is_a?(Net::HTTPSuccess)
        File.binwrite(dest_path, response.body)
        dest_path
      else
        warn "[Smalruby3] HTTP #{response.code} for #{url}"
        nil
      end
    end

    def find_costume_in_catalog(name)
      @catalog["sprites"].each_value do |sprite_data|
        sprite_data["costumes"].each do |c|
          return c if c["name"] == name
        end
      end
      nil
    end

    def find_sound_in_catalog(name)
      @catalog["sprites"].each_value do |sprite_data|
        sprite_data["sounds"].each do |s|
          return s if s["name"] == name
        end
      end
      nil
    end

    def collect_required_assets(sprite_classes, stage_class)
      assets = {}

      sprite_classes.each do |klass|
        sprite_name = klass._sprite_name
        if sprite_name
          sprite_data = @catalog.dig("sprites", sprite_name)
          next unless sprite_data
          sprite_data["costumes"].each { |c| assets[c["md5ext"]] = c["rawURL"] }
          sprite_data["sounds"].each { |s| assets[s["md5ext"]] = nil }
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

      if stage_class
        stage_class._backdrop_names.each do |name|
          data = @catalog.dig("backdrops", name)
          assets[data["md5ext"]] = data["rawURL"] if data
        end
        stage_class._sound_names.each do |name|
          data = find_sound_in_catalog(name)
          assets[data["md5ext"]] = nil if data
        end
      end

      assets
    end
  end
end
