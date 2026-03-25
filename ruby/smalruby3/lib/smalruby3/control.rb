# frozen_string_literal: true

module Smalruby3
  # Override loop to auto-yield each iteration (Scratch behavior).
  # Scratch loops automatically wait 1 frame (~33ms at 30fps) at each iteration end.
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

# Extend Integer#times to support screen_refresh: keyword argument.
# When screen_refresh: true, Fiber.yield is called after each iteration
# to allow screen updates (Scratch repeat block behavior).
# Without screen_refresh: true, times behaves normally.
class Integer
  alias_method :__smalruby3_original_times, :times

  def times(screen_refresh: false, &block)
    if block
      if screen_refresh
        __smalruby3_original_times do |i|
          block.call(i)
          Fiber.yield
        end
      else
        __smalruby3_original_times(&block)
      end
    else
      __smalruby3_original_times
    end
  end
end
