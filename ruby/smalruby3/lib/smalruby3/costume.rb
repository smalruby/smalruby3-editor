# frozen_string_literal: true

module Smalruby3
  class Costume
    attr_reader :name, :path, :rotation_center_x, :rotation_center_y, :bitmap_resolution

    def initialize(name:, path:, rotation_center_x: nil, rotation_center_y: nil, bitmap_resolution: 1)
      @name = name
      @path = path
      @rotation_center_x = rotation_center_x
      @rotation_center_y = rotation_center_y
      @bitmap_resolution = bitmap_resolution || 1
      @surface = nil
      @silhouette = nil
    end

    def surface
      @surface ||= load_surface
    end

    def width
      surface&.w || 0
    end

    def height
      surface&.h || 0
    end

    # Display size accounts for bitmap resolution (2x assets are half size on screen)
    def display_width
      width / @bitmap_resolution
    end

    def display_height
      height / @bitmap_resolution
    end

    def silhouette
      @silhouette ||= begin
        s = surface
        s ? Render::Silhouette.new(s) : nil
      end
    end

    # Load costumes for a sprite from asset directories
    def self.load_for_sprite(sprite_name)
      asset_dirs = resolve_asset_dirs
      costumes = []

      asset_dirs.each do |base_dir|
        sprite_dir = File.join(base_dir, "costumes", sprite_name)
        next unless File.directory?(sprite_dir)

        Dir.glob(File.join(sprite_dir, "*.{png,PNG,bmp,BMP}")).sort.each do |path|
          name = File.basename(path, File.extname(path))
          costumes << new(name: name, path: path)
        end
        break unless costumes.empty?
      end

      costumes
    end

    def self.resolve_asset_dirs
      dirs = []

      # 1. Environment variable
      ENV["SMALRUBY3_ASSETS_PATH"]&.split(File::PATH_SEPARATOR)&.each do |d|
        dirs << d if File.directory?(d)
      end

      # 2. Script directory (caller's $0)
      if $PROGRAM_NAME && !$PROGRAM_NAME.empty?
        script_dir = File.dirname(File.expand_path($PROGRAM_NAME))
        dirs << script_dir if File.directory?(script_dir)
      end

      # 3. Gem's built-in assets
      gem_assets = File.expand_path("../../assets", __dir__)
      dirs << gem_assets if File.directory?(gem_assets)

      dirs.uniq
    end

    private

    def load_surface
      return nil unless @path && File.exist?(@path)
      SDL2::Surface.load(@path)
    end
  end
end
