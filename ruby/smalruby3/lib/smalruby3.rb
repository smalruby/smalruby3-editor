# frozen_string_literal: true

require_relative "smalruby3/version"

module Smalruby3
  # Base directory for all smalruby3 data (cache, future config, etc.).
  # Override with SMALRUBY3_HOME environment variable.
  def self.home
    File.expand_path(ENV.fetch("SMALRUBY3_HOME", File.join(Dir.home, ".smalruby3")))
  end

  class << self
    def start
      @started = true
      Runtime.instance.run
    end

    def started?
      @started || false
    end

    def register_sprite(klass)
      Runtime.instance.register_sprite(klass)
    end

    def register_stage(klass)
      Runtime.instance.register_stage(klass)
    end
  end
end

require_relative "smalruby3/runtime"
require_relative "smalruby3/sequencer"
require_relative "smalruby3/script_fiber"
require_relative "smalruby3/target"
require_relative "smalruby3/dsl"
require_relative "smalruby3/sprite"
require_relative "smalruby3/stage"
require_relative "smalruby3/costume"
require_relative "smalruby3/sound"
require_relative "smalruby3/asset_manager"
require_relative "smalruby3/list"
require_relative "smalruby3/control"
require_relative "smalruby3/render/renderer"
require_relative "smalruby3/render/drawable"
require_relative "smalruby3/render/bitmap_skin"
require_relative "smalruby3/render/silhouette"
require_relative "smalruby3/render/color_util"
require_relative "smalruby3/render/effect_transform"
require_relative "smalruby3/render/collision"
require_relative "smalruby3/render/pen_skin"
require_relative "smalruby3/extension/pen"
require_relative "smalruby3/extension/music"
require_relative "smalruby3/io/keyboard"
require_relative "smalruby3/io/mouse"
require_relative "smalruby3/io/clock"

at_exit do
  if !$ERROR_INFO && !Smalruby3.started? && ENV["SMALRUBY3_TESTING"].nil?
    Smalruby3.start
  end
end
