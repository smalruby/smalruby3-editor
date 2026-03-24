# frozen_string_literal: true

require "test_helper"

class CoordinateTest < Minitest::Test
  def test_scratch_to_screen_center
    x, y = Smalruby3::Render::Drawable.scratch_to_screen(0, 0, 480, 360)
    assert_equal 240, x
    assert_equal 180, y
  end

  def test_scratch_to_screen_top_right
    x, y = Smalruby3::Render::Drawable.scratch_to_screen(240, 180, 480, 360)
    assert_equal 480, x
    assert_equal 0, y
  end

  def test_scratch_to_screen_bottom_left
    x, y = Smalruby3::Render::Drawable.scratch_to_screen(-240, -180, 480, 360)
    assert_equal 0, x
    assert_equal 360, y
  end

  def test_screen_to_scratch_center
    x, y = Smalruby3::Render::Drawable.screen_to_scratch(240, 180, 480, 360)
    assert_equal 0, x
    assert_equal 0, y
  end

  def test_screen_to_scratch_top_left
    x, y = Smalruby3::Render::Drawable.screen_to_scratch(0, 0, 480, 360)
    assert_equal(-240, x)
    assert_equal 180, y
  end

  def test_roundtrip
    (-240..240).step(60) do |sx|
      (-180..180).step(60) do |sy|
        screen_x, screen_y = Smalruby3::Render::Drawable.scratch_to_screen(sx, sy, 480, 360)
        rx, ry = Smalruby3::Render::Drawable.screen_to_scratch(screen_x, screen_y, 480, 360)
        assert_equal sx, rx, "X roundtrip failed for #{sx}"
        assert_equal sy, ry, "Y roundtrip failed for #{sy}"
      end
    end
  end
end
