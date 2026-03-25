# frozen_string_literal: true

require "test_helper"

class ControlTest < Minitest::Test
  def test_times_without_screen_refresh_works_normally
    result = []
    3.times { |i| result << i }
    assert_equal [0, 1, 2], result
  end

  def test_times_without_block_returns_enumerator
    e = 3.times
    assert_kind_of Enumerator, e
    assert_equal [0, 1, 2], e.to_a
  end

  def test_times_with_screen_refresh_yields_fiber
    yields = 0
    fiber = Fiber.new do
      3.times(screen_refresh: true) do |i|
        yields += 1
      end
    end

    # Each iteration should yield the fiber
    fiber.resume # iteration 0 + Fiber.yield
    assert_equal 1, yields

    fiber.resume # iteration 1 + Fiber.yield
    assert_equal 2, yields

    fiber.resume # iteration 2 + Fiber.yield
    assert_equal 3, yields

    # Fiber should be done after final resume
    fiber.resume rescue nil
    refute fiber.alive?
  end

  def test_times_with_screen_refresh_passes_index
    indices = []
    fiber = Fiber.new do
      3.times(screen_refresh: true) do |i|
        indices << i
      end
    end
    3.times { fiber.resume }
    fiber.resume rescue nil
    assert_equal [0, 1, 2], indices
  end

  def test_times_screen_refresh_false_is_same_as_normal
    result = []
    3.times(screen_refresh: false) { |i| result << i }
    assert_equal [0, 1, 2], result
  end

  def test_loop_auto_yields
    steps = []
    runtime = Smalruby3::Runtime.instance
    target = Smalruby3::Target.new(runtime)

    fiber = Fiber.new do
      target.instance_eval do
        count = 0
        loop do
          steps << count
          count += 1
          break if count >= 3
        end
      end
    end

    fiber.resume # loop iteration 0 → Fiber.yield
    assert_equal [0], steps

    fiber.resume # loop iteration 1 → Fiber.yield
    assert_equal [0, 1], steps

    fiber.resume # loop iteration 2 → break
    assert_equal [0, 1, 2], steps
  end
end
