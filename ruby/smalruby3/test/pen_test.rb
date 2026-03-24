# frozen_string_literal: true

require "test_helper"

class PenTest < Minitest::Test
  def setup
    @runtime = Smalruby3::Runtime.instance
    klass = Class.new(Smalruby3::Sprite)
    @sprite = klass.new(@runtime)
  end

  def test_pen_default_state
    pen = @sprite.pen
    refute pen.down?
    assert_in_delta 66.66, pen.color, 0.1
    assert_in_delta 100.0, pen.saturation, 0.1
    assert_in_delta 100.0, pen.brightness, 0.1
    assert_in_delta 0.0, pen.transparency, 0.1
    assert_in_delta 1.0, pen.size, 0.1
  end

  def test_pen_down_up
    pen = @sprite.pen
    pen.down
    assert pen.down?
    pen.up
    refute pen.down?
  end

  def test_pen_color_hex
    pen = @sprite.pen
    pen.color = "#ff0000"
    # Red in HSV: H=0, S=100, B=100
    assert_in_delta 0.0, pen.color, 1.0
    assert_in_delta 100.0, pen.saturation, 1.0
    assert_in_delta 100.0, pen.brightness, 1.0
  end

  def test_pen_color_numeric
    pen = @sprite.pen
    pen.color = 50
    assert_in_delta 50.0, pen.color, 0.01
  end

  def test_pen_size_clamp
    pen = @sprite.pen
    pen.size = 0.5
    assert_in_delta 1.0, pen.size, 0.01 # Min is 1
    pen.size = 10
    assert_in_delta 10.0, pen.size, 0.01
  end

  def test_pen_transparency_clamp
    pen = @sprite.pen
    pen.transparency = -10
    assert_in_delta 0.0, pen.transparency, 0.01
    pen.transparency = 150
    assert_in_delta 100.0, pen.transparency, 0.01
  end
end
