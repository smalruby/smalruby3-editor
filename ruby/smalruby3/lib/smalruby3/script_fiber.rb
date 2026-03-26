# frozen_string_literal: true

module Smalruby3
  class ScriptFiber
    attr_reader :target

    def initialize(target, &block)
      @target = target
      @done = false
      @fiber = Fiber.new do
        target.instance_eval(&block)
      rescue StopThisScript
        # Normal script termination
      ensure
        @done = true
      end
    end

    def resume
      return if done?
      @fiber.resume
    end

    def done?
      @done || !@fiber.alive?
    end

    def stop
      @done = true
    end
  end

  class StopThisScript < StandardError; end
  class StopAll < StandardError; end
end
