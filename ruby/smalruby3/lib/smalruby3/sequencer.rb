# frozen_string_literal: true

module Smalruby3
  class Sequencer
    def initialize(runtime)
      @runtime = runtime
      @fibers = []
    end

    def start_script(target, &block)
      fiber = ScriptFiber.new(target, &block)
      @fibers << fiber
      fiber
    end

    def step_fibers
      @fibers.each do |fiber|
        next if fiber.done?
        fiber.resume
      end
      @fibers.reject!(&:done?)
    end

    def active_count
      @fibers.count { |f| !f.done? }
    end

    def stop_all
      @fibers.each(&:stop)
      @fibers.clear
    end

    def stop_target_scripts(target, except: nil)
      @fibers.each do |fiber|
        next if fiber == except
        fiber.stop if fiber.target == target
      end
      @fibers.reject!(&:done?)
    end
  end
end
