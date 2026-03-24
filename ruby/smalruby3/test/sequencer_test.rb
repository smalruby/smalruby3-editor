# frozen_string_literal: true

require "test_helper"

class SequencerTest < Minitest::Test
  def setup
    @runtime = Smalruby3::Runtime.instance
    @sequencer = Smalruby3::Sequencer.new(@runtime)
  end

  def test_start_script_creates_fiber
    target = Smalruby3::Target.new(@runtime)
    fiber = @sequencer.start_script(target) { "hello" }
    assert_kind_of Smalruby3::ScriptFiber, fiber
    refute fiber.done?
  end

  def test_step_fibers_executes_and_completes
    target = Smalruby3::Target.new(@runtime)
    executed = false
    @sequencer.start_script(target) { executed = true }
    @sequencer.step_fibers
    assert executed
  end

  def test_fiber_yield_pauses_execution
    target = Smalruby3::Target.new(@runtime)
    steps = []
    @sequencer.start_script(target) do
      steps << 1
      Fiber.yield
      steps << 2
      Fiber.yield
      steps << 3
    end

    @sequencer.step_fibers
    assert_equal [1], steps

    @sequencer.step_fibers
    assert_equal [1, 2], steps

    @sequencer.step_fibers
    assert_equal [1, 2, 3], steps
  end

  def test_done_fibers_are_removed
    target = Smalruby3::Target.new(@runtime)
    @sequencer.start_script(target) { "done" }
    assert_equal 1, @sequencer.active_count
    @sequencer.step_fibers
    assert_equal 0, @sequencer.active_count
  end

  def test_stop_all
    target = Smalruby3::Target.new(@runtime)
    @sequencer.start_script(target) { Fiber.yield; "never" }
    @sequencer.start_script(target) { Fiber.yield; "never" }
    @sequencer.step_fibers
    assert_equal 2, @sequencer.active_count
    @sequencer.stop_all
    assert_equal 0, @sequencer.active_count
  end
end
