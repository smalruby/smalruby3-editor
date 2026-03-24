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
  end
end
