# frozen_string_literal: true

module Smalruby3
  # Override loop and times to auto-yield each iteration (Scratch behavior).
  # Scratch loops automatically wait 1 frame (~33ms at 30fps) at each iteration end.
  module Control
    def loop(&block)
      Kernel.loop do
        block.call
        Fiber.yield
      end
    end

    # Override Integer#times in sprite context
    def smalruby_times(n, &block)
      n.to_i.times do |i|
        block.call(i)
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
