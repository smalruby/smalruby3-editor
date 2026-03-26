# frozen_string_literal: true

require "test_helper"

class ColorUtilTest < Minitest::Test
  CU = Smalruby3::Render::ColorUtil

  def test_hex_to_rgb
    assert_equal [255, 0, 0], CU.hex_to_rgb("#ff0000")
    assert_equal [0, 255, 0], CU.hex_to_rgb("#00ff00")
    assert_equal [0, 0, 255], CU.hex_to_rgb("#0000ff")
    assert_equal [255, 255, 255], CU.hex_to_rgb("#ffffff")
    assert_equal [0, 0, 0], CU.hex_to_rgb("#000000")
  end

  def test_color_matches_exact
    assert CU.color_matches?([255, 0, 0], [255, 0, 0])
    assert CU.color_matches?([0, 255, 0], [0, 255, 0])
  end

  def test_color_matches_within_tolerance
    # Top 5 bits for R/G (tolerance of 7), top 4 bits for B (tolerance of 15)
    assert CU.color_matches?([255, 0, 0], [250, 0, 0])
    assert CU.color_matches?([0, 0, 255], [0, 0, 240])
  end

  def test_color_does_not_match
    refute CU.color_matches?([255, 0, 0], [0, 255, 0])
    refute CU.color_matches?([255, 0, 0], [200, 0, 0])
  end

  def test_mask_matches
    assert CU.mask_matches?([255, 0, 0, 255], [255, 0, 0])
    assert CU.mask_matches?([252, 0, 0, 128], [255, 0, 0])
  end

  def test_mask_does_not_match_transparent
    refute CU.mask_matches?([255, 0, 0, 0], [255, 0, 0])
  end

  def test_blend_single_opaque
    result = CU.blend_colors([[255, 0, 0, 255]])
    assert_equal [255, 0, 0], result
  end

  def test_blend_transparent_shows_white_bg
    result = CU.blend_colors([])
    assert_equal [255, 255, 255], result
  end

  def test_blend_semi_transparent
    result = CU.blend_colors([[255, 0, 0, 128]])
    # 255 * 0.502 + 255 * 0.498 ≈ 255
    assert_in_delta 255, result[0], 2
    assert_in_delta 127, result[1], 2
    assert_in_delta 127, result[2], 2
  end

  def test_rgb_to_hsv_red
    h, s, v = CU.rgb_to_hsv(255, 0, 0)
    assert_in_delta 0.0, h, 0.01
    assert_in_delta 1.0, s, 0.01
    assert_in_delta 1.0, v, 0.01
  end

  def test_rgb_to_hsv_green
    h, s, v = CU.rgb_to_hsv(0, 255, 0)
    assert_in_delta 0.333, h, 0.01
    assert_in_delta 1.0, s, 0.01
    assert_in_delta 1.0, v, 0.01
  end

  def test_rgb_to_hsv_white
    _, s, v = CU.rgb_to_hsv(255, 255, 255)
    assert_in_delta 0.0, s, 0.01
    assert_in_delta 1.0, v, 0.01
  end

  def test_hsv_roundtrip
    [
      [255, 0, 0], [0, 255, 0], [0, 0, 255],
      [128, 64, 32], [200, 100, 50]
    ].each do |rgb|
      h, s, v = CU.rgb_to_hsv(*rgb)
      result = CU.hsv_to_rgb(h, s, v)
      assert_in_delta rgb[0], result[0], 2, "R mismatch for #{rgb}"
      assert_in_delta rgb[1], result[1], 2, "G mismatch for #{rgb}"
      assert_in_delta rgb[2], result[2], 2, "B mismatch for #{rgb}"
    end
  end
end
