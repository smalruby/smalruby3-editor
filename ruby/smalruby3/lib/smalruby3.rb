# frozen_string_literal: true

require_relative "smalruby3/version"

module Smalruby3
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
require_relative "smalruby3/list"
require_relative "smalruby3/control"
require_relative "smalruby3/render/renderer"
require_relative "smalruby3/render/drawable"
require_relative "smalruby3/render/bitmap_skin"
require_relative "smalruby3/io/keyboard"
require_relative "smalruby3/io/mouse"
require_relative "smalruby3/io/clock"

at_exit do
  if !$ERROR_INFO && !Smalruby3.started? && ENV["SMALRUBY3_TESTING"].nil?
    Smalruby3.start
  end
end
