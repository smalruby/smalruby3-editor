# frozen_string_literal: true

require "test_helper"

class EffectTransformTest < Minitest::Test
  ET = Smalruby3::Render::EffectTransform

  # --- Effect value converters ---

  def test_ghost_converter
    assert_in_delta 1.0, ET.convert_effect("ghost", 0), 0.01   # fully opaque
    assert_in_delta 0.5, ET.convert_effect("ghost", 50), 0.01  # half transparent
    assert_in_delta 0.0, ET.convert_effect("ghost", 100), 0.01 # fully invisible
  end

  def test_color_converter
    assert_in_delta 0.0, ET.convert_effect("color", 0), 0.01
    assert_in_delta 0.5, ET.convert_effect("color", 100), 0.01
    assert_in_delta 0.0, ET.convert_effect("color", 200), 0.01 # wraps
  end

  def test_brightness_converter
    assert_in_delta 0.0, ET.convert_effect("brightness", 0), 0.01
    assert_in_delta 1.0, ET.convert_effect("brightness", 100), 0.01
    assert_in_delta(-1.0, ET.convert_effect("brightness", -100), 0.01)
    assert_in_delta 1.0, ET.convert_effect("brightness", 200), 0.01 # clamped
  end

  def test_fisheye_converter
    assert_in_delta 1.0, ET.convert_effect("fisheye", 0), 0.01
    assert_in_delta 2.0, ET.convert_effect("fisheye", 100), 0.01
    assert_in_delta 0.0, ET.convert_effect("fisheye", -100), 0.01
  end

  def test_whirl_converter
    assert_in_delta 0.0, ET.convert_effect("whirl", 0), 0.01
    val = ET.convert_effect("whirl", 180)
    assert_in_delta(-Math::PI, val, 0.01)
  end

  def test_pixelate_converter
    assert_in_delta 0.0, ET.convert_effect("pixelate", 0), 0.01
    assert_in_delta 10.0, ET.convert_effect("pixelate", 100), 0.01
  end

  def test_mosaic_converter
    assert_equal 1, ET.convert_effect("mosaic", 0)
    assert_equal 2, ET.convert_effect("mosaic", 10)
    assert_equal 512, ET.convert_effect("mosaic", 9999) # clamped
  end

  # --- transform_color ---

  def test_ghost_effect_full
    r, g, b, a = ET.transform_color({"ghost" => 100}, 255, 0, 0, 255)
    assert_equal 0, a
  end

  def test_ghost_effect_half
    r, g, b, a = ET.transform_color({"ghost" => 50}, 255, 0, 0, 255)
    assert_in_delta 128, a, 2
  end

  def test_ghost_no_effect_on_transparent
    r, g, b, a = ET.transform_color({"ghost" => 50}, 0, 0, 0, 0)
    assert_equal 0, a
  end

  def test_brightness_positive
    r, g, b, a = ET.transform_color({"brightness" => 100}, 100, 100, 100, 255)
    assert_equal 255, r  # clamped to 255
    assert_equal 255, g
    assert_equal 255, b
    assert_equal 255, a
  end

  def test_brightness_negative
    r, g, b, a = ET.transform_color({"brightness" => -100}, 100, 100, 100, 255)
    assert_equal 0, r
    assert_equal 0, g
    assert_equal 0, b
  end

  def test_no_effects
    r, g, b, a = ET.transform_color({}, 128, 64, 32, 200)
    assert_equal 128, r
    assert_equal 64, g
    assert_equal 32, b
    assert_equal 200, a
  end

  # --- transform_point ---

  def test_no_shape_effects
    x, y = ET.transform_point({}, 0.5, 0.5, 100, 100)
    assert_in_delta 0.5, x, 0.01
    assert_in_delta 0.5, y, 0.01
  end

  def test_mosaic_effect
    x, y = ET.transform_point({"mosaic" => 10}, 0.5, 0.5, 100, 100)
    # mosaic=10 → converter → 2, so (2 * 0.5) % 1 = 0.0
    assert_in_delta 0.0, x, 0.01
    assert_in_delta 0.0, y, 0.01
  end

  def test_pixelate_effect
    x, y = ET.transform_point({"pixelate" => 50}, 0.33, 0.67, 100, 100)
    # pixelate=50 → converter → 5.0
    # texel_x = 100 / 5 = 20
    # x = (floor(0.33 * 20) + 0.5) / 20 = (6 + 0.5) / 20 = 0.325
    assert_in_delta 0.325, x, 0.01
  end

  # --- has_shape_effects? / has_color_effects? ---

  def test_has_shape_effects
    assert ET.has_shape_effects?({"whirl" => 45})
    refute ET.has_shape_effects?({"ghost" => 50})
    refute ET.has_shape_effects?({})
    refute ET.has_shape_effects?({"whirl" => 0})
  end

  def test_has_color_effects
    assert ET.has_color_effects?({"ghost" => 50})
    assert ET.has_color_effects?({"color" => 25})
    refute ET.has_color_effects?({"whirl" => 45})
    refute ET.has_color_effects?({})
  end
end
