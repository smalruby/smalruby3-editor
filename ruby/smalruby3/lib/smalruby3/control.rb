# frozen_string_literal: true

module Smalruby3
  # Provides with_screen_refresh for Scratch-compatible frame-based iteration.
  # In Scratch, every loop iteration yields to the scheduler for a screen update.
  module Control
    # Wrap a block of code with a screen refresh (Fiber.yield) at the end.
    # Used inside while/until loops to ensure each iteration yields.
    #
    #   until touching?("goal")
    #     with_screen_refresh do
    #       next if keyboard.pressed?("space")
    #       move(10)
    #     end
    #   end
    #
    def with_screen_refresh
      yield
    ensure
      Fiber.yield
    end
  end
end

# Patch Target to include Control
module Smalruby3
  class Target
    include Control
  end
end

# Add with_screen_refresh to Enumerator for times/loop support.
#
#   10.times.with_screen_refresh do |i|
#     move(10)
#   end
#
#   loop.with_screen_refresh do
#     move(2)
#     bounce_if_on_edge
#   end
#
class Enumerator
  def with_screen_refresh(&block)
    each do |*args|
      block.call(*args)
      Fiber.yield
    end
  end
end
