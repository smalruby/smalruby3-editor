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
      @backdrops = []
      @current_backdrop = self.class._initial_backdrop
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
