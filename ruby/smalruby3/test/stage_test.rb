# frozen_string_literal: true

require "test_helper"

class StageTest < Minitest::Test
  def setup
    @runtime = Smalruby3::Runtime.instance
    @runtime.reset_stage_class!
  end

  def teardown
    @runtime.reset_stage_class!
  end

  def test_default_stage_is_created
    # init_targets creates a default Stage when no stage_class is registered
    # Runtime.instance already has no stage_class by default
    runtime = Smalruby3::Runtime.instance
    # Reset for clean test
    runtime.instance_variable_set(:@stage_class, nil)
    runtime.instance_variable_set(:@stage, nil)
    runtime.instance_variable_set(:@sprites, [])
    runtime.instance_variable_set(:@sprite_classes, [])
    runtime.send(:init_targets)

    assert_instance_of Smalruby3::Stage, runtime.stage
    assert runtime.stage.visible
  end

  def test_custom_stage_is_used
    runtime = Smalruby3::Runtime.instance
    custom_stage = Class.new(Smalruby3::Stage)
    runtime.instance_variable_set(:@stage_class, custom_stage)
    runtime.instance_variable_set(:@stage, nil)
    runtime.instance_variable_set(:@sprites, [])
    runtime.instance_variable_set(:@sprite_classes, [])
    runtime.send(:init_targets)

    assert_instance_of custom_stage, runtime.stage
  end

  def test_only_one_stage_class_allowed
    stage1 = Class.new(Smalruby3::Stage)
    # stage1 is auto-registered via inherited hook

    assert_raises(RuntimeError) do
      # Manually registering a different class should raise
      other = Class.new(Smalruby3::Target) # Not via inherited
      @runtime.register_stage(other)
    end
  end

  def test_backdrop_number_default
    stage = Smalruby3::Stage.new(@runtime)
    assert_equal 1, stage.backdrop_number
  end

  def test_backdrop_name_default
    stage = Smalruby3::Stage.new(@runtime)
    assert_equal "", stage.backdrop_name
  end
end
