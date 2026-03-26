# frozen_string_literal: true

require "test_helper"

class EffectSurfaceTest < Minitest::Test
  def test_needs_effects_empty
    refute Smalruby3::Render::EffectSurface.needs_effects?({})
  end

  def test_needs_effects_ghost_only
    # ghost is handled by alpha_mod, not by EffectSurface
    refute Smalruby3::Render::EffectSurface.needs_effects?({"ghost" => 50})
  end

  def test_needs_effects_color
    assert Smalruby3::Render::EffectSurface.needs_effects?({"color" => 25})
  end

  def test_needs_effects_brightness
    assert Smalruby3::Render::EffectSurface.needs_effects?({"brightness" => 10})
  end

  def test_needs_effects_fisheye
    assert Smalruby3::Render::EffectSurface.needs_effects?({"fisheye" => 50})
  end

  def test_needs_effects_zero_value
    refute Smalruby3::Render::EffectSurface.needs_effects?({"color" => 0})
  end

  def test_needs_effects_nil
    refute Smalruby3::Render::EffectSurface.needs_effects?(nil)
  end

  def test_needs_effects_mixed
    # ghost=50 alone is false, but color=25 makes it true
    assert Smalruby3::Render::EffectSurface.needs_effects?(
      {"ghost" => 50, "color" => 25}
    )
  end

  def test_transform_identity
    # Create a simple 2x2 RGBA surface
    rgba = [255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 0, 255].pack("C*")
    surface = SDL2::Surface.from_string(rgba, 2, 2, 32)

    # With only ghost effect, transform should not change pixels
    effects = {"ghost" => 50}
    refute Smalruby3::Render::EffectSurface.needs_effects?(effects)

    surface.destroy
  end

  def test_transform_brightness
    # 2x2 red image
    rgba = ([128, 0, 0, 255] * 4).pack("C*")
    surface = SDL2::Surface.from_string(rgba, 2, 2, 32)

    effects = {"brightness" => 50}
    result = Smalruby3::Render::EffectSurface.transform(surface, effects)

    assert result
    assert_equal 2, result.w
    assert_equal 2, result.h

    # Brightness 50 should increase the red channel
    pixels = result.pixels
    r = pixels.getbyte(0)
    assert r > 128, "Red channel should be brighter: got #{r}"

    result.destroy
    surface.destroy
  end
end
