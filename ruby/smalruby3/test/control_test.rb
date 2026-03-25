# frozen_string_literal: true

require "test_helper"

class ControlTest < Minitest::Test
  # --- Enumerator#with_screen_refresh (times) ---

  def test_times_with_screen_refresh_yields_fiber
    yields = 0
    fiber = Fiber.new do
      3.times.with_screen_refresh do |_i|
        yields += 1
      end
    end

    fiber.resume # iteration 0 + Fiber.yield
    assert_equal 1, yields

    fiber.resume # iteration 1 + Fiber.yield
    assert_equal 2, yields

    fiber.resume # iteration 2 + Fiber.yield
    assert_equal 3, yields

    # Fiber should finish after one more resume
    fiber.resume rescue nil
    refute fiber.alive?
  end

  def test_times_with_screen_refresh_passes_index
    indices = []
    fiber = Fiber.new do
      3.times.with_screen_refresh do |i|
        indices << i
      end
    end
    3.times { fiber.resume }
    fiber.resume rescue nil
    assert_equal [0, 1, 2], indices
  end

  def test_times_without_with_screen_refresh_is_normal
    result = []
    3.times { |i| result << i }
    assert_equal [0, 1, 2], result
  end

  def test_times_without_block_returns_enumerator
    e = 3.times
    assert_kind_of Enumerator, e
  end

  # --- Enumerator#with_screen_refresh (loop) ---

  def test_loop_with_screen_refresh_yields_fiber
    steps = []
    fiber = Fiber.new do
      count = 0
      loop.with_screen_refresh do
        steps << count
        count += 1
        break if count >= 3
      end
    end

    fiber.resume
    assert_equal [0], steps

    fiber.resume
    assert_equal [0, 1], steps

    fiber.resume
    assert_equal [0, 1, 2], steps
  end

  # --- Target#with_screen_refresh (while/until body wrapper) ---

  def test_with_screen_refresh_in_until_loop
    runtime = Smalruby3::Runtime.instance
    target = Smalruby3::Target.new(runtime)

    steps = []
    count = 0
    fiber = Fiber.new do
      target.instance_eval do
        until count >= 3
          with_screen_refresh do
            steps << count
            count += 1
          end
        end
      end
    end

    fiber.resume
    assert_equal [0], steps

    fiber.resume
    assert_equal [0, 1], steps

    fiber.resume
    assert_equal [0, 1, 2], steps

    # Loop condition met, fiber finishes
    fiber.resume rescue nil
    refute fiber.alive?
  end

  def test_with_screen_refresh_next_still_yields
    runtime = Smalruby3::Runtime.instance
    target = Smalruby3::Target.new(runtime)

    steps = []
    count = 0
    fiber = Fiber.new do
      target.instance_eval do
        until count >= 4
          with_screen_refresh do
            count += 1
            next if count == 2  # Skip step 2 but still yield
            steps << count
          end
        end
      end
    end

    fiber.resume # count=1, steps=[1]
    assert_equal [1], steps

    fiber.resume # count=2, next → skip steps << 2, but Fiber.yield still called
    assert_equal [1], steps

    fiber.resume # count=3, steps=[1, 3]
    assert_equal [1, 3], steps

    fiber.resume # count=4, steps=[1, 3, 4]
    assert_equal [1, 3, 4], steps

    fiber.resume rescue nil
    refute fiber.alive?
  end

  def test_with_screen_refresh_in_while_loop
    runtime = Smalruby3::Runtime.instance
    target = Smalruby3::Target.new(runtime)

    steps = []
    count = 0
    fiber = Fiber.new do
      target.instance_eval do
        while count < 2
          with_screen_refresh do
            steps << count
            count += 1
          end
        end
      end
    end

    fiber.resume
    assert_equal [0], steps

    fiber.resume
    assert_equal [0, 1], steps

    fiber.resume rescue nil
    refute fiber.alive?
  end
end
