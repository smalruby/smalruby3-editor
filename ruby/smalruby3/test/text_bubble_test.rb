# frozen_string_literal: true

require "test_helper"

class TextBubbleTest < Minitest::Test
  def test_calc_position_basic
    bubble = Smalruby3::Render::TextBubble.new(nil)
    sprite = Minitest::Mock.new
    sprite.expect(:current_costume_obj, nil)
    sprite.expect(:size, 100)
    sprite.expect(:x, 0)
    sprite.expect(:y, 0)

    x, y, on_right = bubble.send(:calc_position, sprite, 100, 50, 480, 360)
    assert x >= 0, "x should be >= 0"
    assert y >= 0, "y should be >= 0"
    assert_includes [true, false], on_right
  end

  def test_calc_position_right_edge
    bubble = Smalruby3::Render::TextBubble.new(nil)
    sprite = Minitest::Mock.new
    sprite.expect(:current_costume_obj, nil)
    sprite.expect(:size, 100)
    sprite.expect(:x, 220)
    sprite.expect(:y, 0)

    x, _y, _on_right = bubble.send(:calc_position, sprite, 100, 50, 480, 360)
    assert x + 100 <= 480, "bubble should not overflow right edge"
  end

  def test_constants
    assert_equal 330, Smalruby3::Render::TextBubble::MAX_TEXT_LENGTH
    assert_equal 170, Smalruby3::Render::TextBubble::MAX_LINE_WIDTH
    assert_equal 50, Smalruby3::Render::TextBubble::MIN_WIDTH
    assert_equal 14, Smalruby3::Render::TextBubble::FONT_SIZE
  end

  def test_cjk_detection
    bubble = Smalruby3::Render::TextBubble.new(nil)
    assert bubble.send(:cjk?, "あ")
    assert bubble.send(:cjk?, "漢")
    refute bubble.send(:cjk?, "a")
    refute bubble.send(:cjk?, " ")
  end
end
