# frozen_string_literal: true

require "json"
require "net/http"
require "uri"
require "fileutils"
require "tempfile"

module Smalruby3
  class AssetManager
    CACHE_DIR = File.join(Dir.home, ".cache", "smalruby3", "assets")
    SCRATCH_ASSET_URL = "https://assets.scratch.mit.edu/internalapi/asset/%{md5ext}/get/"
    SMALRUBY_ASSET_BASE_URL = "https://smalruby.app/"

    # md5ext must be hex hash + dot + lowercase extension
    SAFE_MD5EXT = /\A[a-f0-9]+\.(png|svg|wav|mp3|jpg)\z/

    # Maximum asset size: 10 MB
    MAX_ASSET_SIZE = 10 * 1024 * 1024

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
      return nil unless valid_md5ext?(md5ext)

      # 1. Check preset assets
      preset_path = find_preset(md5ext)
      return preset_path if preset_path

      # 2. Check cache (must be a regular file, not a symlink)
      cache_path = safe_cache_path(md5ext)
      return nil unless cache_path
      return cache_path if regular_file?(cache_path)

      # 3. Download
      download_asset(md5ext, raw_url, cache_path)
    end

    def find_preset(md5ext)
      preset_dir = File.expand_path("../../assets/preset", __dir__)
      path = File.join(preset_dir, md5ext)
      resolved = File.expand_path(path)
      return nil unless resolved.start_with?("#{File.expand_path(preset_dir)}/")
      regular_file?(resolved) ? resolved : nil
    end

    # Validate md5ext format to prevent path traversal.
    def valid_md5ext?(md5ext)
      md5ext.is_a?(String) && md5ext.match?(SAFE_MD5EXT)
    end

    # Build a safe cache path and verify it stays within CACHE_DIR.
    def safe_cache_path(md5ext)
      path = File.join(CACHE_DIR, md5ext)
      resolved = File.expand_path(path)
      return nil unless resolved.start_with?("#{File.expand_path(CACHE_DIR)}/")
      resolved
    end

    # Check that path is a regular file (not a symlink, directory, etc.)
    def regular_file?(path)
      File.exist?(path) && !File.symlink?(path) && File.file?(path)
    end

    def download_asset(md5ext, raw_url, cache_path)
      url = build_download_url(md5ext, raw_url)
      return nil unless url

      safe_download(url, cache_path)
    rescue => e
      warn "[Smalruby3] Failed to download asset #{md5ext}: #{e.message}"
      nil
    end

    # Build download URL, rejecting absolute rawURL values.
    def build_download_url(md5ext, raw_url)
      if raw_url
        # Reject absolute URLs to prevent catalog-based URL override
        if raw_url.match?(%r{\A[a-z]+://}i)
          warn "[Smalruby3] Rejecting absolute rawURL: #{raw_url}"
          return nil
        end
        URI.join(SMALRUBY_ASSET_BASE_URL, raw_url).to_s
      else
        format(SCRATCH_ASSET_URL, md5ext: md5ext)
      end
    end

    # Download file with security checks:
    # - HTTPS only
    # - Redirect validation (HTTPS only, max 3)
    # - Size limit
    # - Atomic write via temp file (prevents symlink attacks)
    def safe_download(url, dest_path)
      uri = URI.parse(url)
      validate_uri!(uri)

      body = fetch_with_redirects(uri)
      return nil unless body

      # Atomic write: write to temp file, then rename
      # This prevents symlink TOCTOU attacks
      write_atomically(dest_path, body)
    end

    def fetch_with_redirects(uri, redirects_remaining = 3)
      response = https_get(uri)

      redirects_remaining.times do
        break unless response.is_a?(Net::HTTPRedirection)

        location = response["location"]
        uri = URI.parse(location)
        validate_uri!(uri)
        response = https_get(uri)
      end

      if response.is_a?(Net::HTTPSuccess)
        body = response.body
        if body.bytesize > MAX_ASSET_SIZE
          warn "[Smalruby3] Asset too large (#{body.bytesize} bytes, max #{MAX_ASSET_SIZE})"
          return nil
        end
        body
      else
        warn "[Smalruby3] HTTP #{response.code} for #{uri}"
        nil
      end
    end

    def https_get(uri)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true
      http.open_timeout = 10
      http.read_timeout = 30
      http.request(Net::HTTP::Get.new(uri))
    end

    # Validate URI: must be HTTPS
    def validate_uri!(uri)
      unless uri.is_a?(URI::HTTPS)
        raise SecurityError, "Only HTTPS URLs are allowed (got #{uri.scheme})"
      end
    end

    # Write content atomically to prevent symlink TOCTOU attacks.
    # Creates a temp file in the same directory, then renames it.
    def write_atomically(dest_path, content)
      # Reject if destination is a symlink
      if File.symlink?(dest_path)
        warn "[Smalruby3] Refusing to write to symlink: #{dest_path}"
        return nil
      end

      dir = File.dirname(dest_path)
      tmp = Tempfile.new("smalruby3-", dir)
      tmp.binmode
      tmp.write(content)
      tmp.close
      File.rename(tmp.path, dest_path)
      dest_path
    rescue => e
      tmp&.close!
      raise e
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
