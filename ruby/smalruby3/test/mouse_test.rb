# frozen_string_literal: true

require "test_helper"

class MouseTest < Minitest::Test
  def setup
    @mouse = Smalruby3::IO::Mouse.new
  end

  def test_default_position
    assert_equal(-240, @mouse.x)  # 0 - 240
    assert_equal 180, @mouse.y    # 180 - 0
  end

  def test_center_position
    @mouse.handle_motion(240, 180)
    assert_equal 0, @mouse.x
    assert_equal 0, @mouse.y
  end

  def test_button_state
    refute @mouse.down?
    @mouse.handle_button_down
    assert @mouse.down?
    @mouse.handle_button_up
    refute @mouse.down?
  end
end
