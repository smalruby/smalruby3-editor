# frozen_string_literal: true

require "test_helper"

class KeyboardTest < Minitest::Test
  def setup
    @keyboard = Smalruby3::IO::Keyboard.new
  end

  def test_not_pressed_by_default
    refute @keyboard.pressed?("space")
    refute @keyboard.pressed?("left arrow")
  end

  def test_pressed_after_key_down
    @keyboard.handle_key_down(44) # SPACE scancode
    assert @keyboard.pressed?("space")
  end

  def test_not_pressed_after_key_up
    @keyboard.handle_key_down(44)
    @keyboard.handle_key_up(44)
    refute @keyboard.pressed?("space")
  end

  def test_arrow_keys
    @keyboard.handle_key_down(80) # LEFT
    assert @keyboard.pressed?("left arrow")
    @keyboard.handle_key_down(79) # RIGHT
    assert @keyboard.pressed?("right arrow")
    @keyboard.handle_key_down(82) # UP
    assert @keyboard.pressed?("up arrow")
    @keyboard.handle_key_down(81) # DOWN
    assert @keyboard.pressed?("down arrow")
  end

  def test_letter_keys
    @keyboard.handle_key_down(4) # A
    assert @keyboard.pressed?("a")
    @keyboard.handle_key_down(29) # Z
    assert @keyboard.pressed?("z")
  end

  def test_number_keys
    @keyboard.handle_key_down(39) # 0
    assert @keyboard.pressed?("0")
    @keyboard.handle_key_down(30) # 1
    assert @keyboard.pressed?("1")
    @keyboard.handle_key_down(38) # 9
    assert @keyboard.pressed?("9")
  end

  def test_any_pressed
    refute @keyboard.any_pressed?
    @keyboard.handle_key_down(44)
    assert @keyboard.any_pressed?
  end
end
