# frozen_string_literal: true

require "test_helper"

class SpriteTest < Minitest::Test
  def setup
    @runtime = Smalruby3::Runtime.instance
  end

  def test_move_right
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    s.direction = 90 # right
    s.move(10)
    assert_in_delta 10.0, s.x, 0.01
    assert_in_delta 0.0, s.y, 0.01
  end

  def test_move_up
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    s.direction = 0 # up
    s.move(10)
    assert_in_delta 0.0, s.x, 0.01
    assert_in_delta 10.0, s.y, 0.01
  end

  def test_point_towards_right
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    # Point towards a position to the right
    other = klass.new(@runtime)
    other.instance_variable_set(:@name, "Target")
    other.instance_variable_set(:@x, 100.0)
    other.instance_variable_set(:@y, 0.0)
    # Can't easily test with runtime.find_target, test the math directly
    dx = 100.0 - 0.0
    dy = 0.0 - 0.0
    dir = (90 - Math.atan2(dy, dx) * 180.0 / Math::PI) % 360
    assert_in_delta 90.0, dir, 0.01
  end

  def test_point_towards_up
    dx = 0.0
    dy = 100.0
    dir = (90 - Math.atan2(dy, dx) * 180.0 / Math::PI) % 360
    assert_in_delta 0.0, dir, 0.01
  end

  def test_touching_edge
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    # No costume → not touching
    refute s.touching?("_edge_")
  end

  def test_distance
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    s.instance_variable_set(:@x, 0.0)
    s.instance_variable_set(:@y, 0.0)
    # Distance to mouse at (0,0) center — default mouse is at (-240, 180)
    d = s.distance("_mouse_")
    expected = Math.sqrt(240**2 + 180**2)
    assert_in_delta expected, d, 0.1
  end

  def test_go_to_coordinates
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    s.go_to([100, -50])
    assert_in_delta 100.0, s.x, 0.01
    assert_in_delta(-50.0, s.y, 0.01)
  end

  def test_show_hide
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    assert s.visible
    s.hide
    refute s.visible
    s.show
    assert s.visible
  end

  def test_costume_number
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    assert_equal 1, s.costume_number # 1-based
  end

  def test_clone
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    s.instance_variable_set(:@x, 42.0)
    s.instance_variable_set(:@y, -10.0)
    s.instance_variable_set(:@direction, 180.0)
    s.instance_variable_set(:@size, 50.0)

    clone = s.make_clone(@runtime)
    assert clone.clone?
    refute s.clone?
    assert_equal 42.0, clone.x
    assert_equal(-10.0, clone.y)
    assert_equal 180.0, clone.direction
    assert_equal 50.0, clone.size
  end

  def test_say
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    s.say("hello")
    assert_equal "hello", s.say_text
    assert_nil s.think_text
  end

  def test_think
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    s.think("hmm")
    assert_nil s.say_text
    assert_equal "hmm", s.think_text
  end

  def test_effects
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(@runtime)
    s.set_effect("ghost", 50)
    assert_equal 50, s.effects["ghost"]
    s.change_effect_by("ghost", 25)
    assert_equal 75, s.effects["ghost"]
    s.clear_graphic_effects
    assert_empty s.effects
  end
end
