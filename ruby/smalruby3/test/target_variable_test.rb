# frozen_string_literal: true

require "test_helper"

class TargetVariableTest < Minitest::Test
  def setup
    @runtime = Smalruby3::Runtime.instance
  end

  def test_variable_reads_instance_variable
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    s.instance_variable_set(:@score, 42)
    assert_equal 42, s.variable("@score")
  end

  def test_variable_reads_without_at_prefix
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    s.instance_variable_set(:@score, 99)
    assert_equal 99, s.variable("score")
  end

  def test_variable_returns_nil_for_undefined
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    assert_nil s.variable("@nonexistent")
  end

  def test_variable_reads_global_variable_notation
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    # Global variables use $ prefix but are stored as instance variables in Scratch
    s.instance_variable_set(:@global_score, 100)
    assert_equal 100, s.variable("@global_score")
  end

  def test_sprite_backdrop_number_delegates_to_stage
    @runtime.reset_stage_class!
    @runtime.instance_variable_set(:@stage, nil)
    @runtime.instance_variable_set(:@sprites, [])
    @runtime.instance_variable_set(:@sprite_classes, [])
    @runtime.send(:init_targets)

    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    assert_equal @runtime.stage.backdrop_number, s.backdrop_number
  end

  def test_sprite_backdrop_name_delegates_to_stage
    @runtime.reset_stage_class!
    @runtime.instance_variable_set(:@stage, nil)
    @runtime.instance_variable_set(:@sprites, [])
    @runtime.instance_variable_set(:@sprite_classes, [])
    @runtime.send(:init_targets)

    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    assert_equal @runtime.stage.backdrop_name, s.backdrop_name
  end
end
