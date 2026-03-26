# frozen_string_literal: true

module Smalruby3
  class Stage < Target
    extend DSL::StageClassMethods

    def self.inherited(subclass)
      super
      Smalruby3.register_stage(subclass)
    end

    def initialize(runtime)
      super
      am = @runtime.asset_manager
      @backdrops = if self.class._backdrop_names.any?
        am.resolve_backdrops(self.class._backdrop_names)
      else
        # Default white backdrop
        preset_path = File.expand_path("../../assets/preset/backdrop-white-2x2.png", __dir__)
        if File.exist?(preset_path)
          [Costume.new(name: "backdrop1", path: preset_path,
            rotation_center_x: 240, rotation_center_y: 180)]
        else
          []
        end
      end
      @current_backdrop = self.class._initial_backdrop

      @sounds = if self.class._sound_names.any?
        am.resolve_sounds_by_name(self.class._sound_names)
      else
        []
      end
    end

    def backdrop_number
      @current_backdrop + 1
    end

    def backdrop_name
      @backdrops[@current_backdrop]&.name || ""
    end

    def switch_backdrop(name)
      idx = @backdrops.index { |b| b.name == name.to_s }
      if idx
        @current_backdrop = idx
        @runtime.start_hats(:backdrop_switches, name.to_s)
      end
    end

    def switch_backdrop_and_wait(name)
      switch_backdrop(name)
      # Wait one frame for triggered scripts to start, then wait for them
      Fiber.yield
    end

    def next_backdrop
      @current_backdrop = (@current_backdrop + 1) % [@backdrops.size, 1].max
      @runtime.start_hats(:backdrop_switches, backdrop_name)
    end
  end
end
