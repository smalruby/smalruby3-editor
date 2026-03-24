# frozen_string_literal: true

module Smalruby3
  class Target
    attr_reader :runtime, :name
    attr_accessor :visible

    def initialize(runtime)
      @runtime = runtime
      @name = if self.class.respond_to?(:_name)
                self.class._name || self.class.name&.split("::")&.last || "unnamed"
              else
                self.class.name&.split("::")&.last || "unnamed"
              end
      @visible = self.class.respond_to?(:_initial_visible) ? self.class._initial_visible : true
    end

    def keyboard
      @runtime.keyboard
    end

    def mouse
      @runtime.mouse
    end

    def timer
      @runtime.clock
    end

    def sprite(name)
      @runtime.find_target(name)
    end

    def stage
      @runtime.stage
    end

    def stop(target)
      case target
      when "all"
        @runtime.sequencer.stop_all
        raise StopAll
      when "this script"
        raise StopThisScript
      when "other scripts in sprite"
        current_fiber = Fiber.current
        @runtime.sequencer.stop_target_scripts(self, except: current_fiber)
      end
    end

    def sleep(seconds)
      frames = (seconds.to_f * Runtime::FPS).ceil
      frames.times { Fiber.yield }
    end
  end
end
