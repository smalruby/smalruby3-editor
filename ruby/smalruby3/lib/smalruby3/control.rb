# frozen_string_literal: true

module Smalruby3
  # Override loop to auto-yield each iteration (Scratch behavior).
  # This module is included in Target so it's available in sprite scripts.
  module Control
    def loop(&block)
      Kernel.loop do
        block.call
        Fiber.yield
      end
    end
  end
end

# Patch Target to include Control
module Smalruby3
  class Target
    include Control
  end
end
