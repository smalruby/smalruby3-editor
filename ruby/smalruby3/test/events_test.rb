# frozen_string_literal: true

require "test_helper"

class EventsTest < Minitest::Test
  def setup
    @runtime = Smalruby3::Runtime.instance
    @sequencer = Smalruby3::Sequencer.new(@runtime)
  end

  def test_broadcast_triggers_receiver
    received = false
    klass = Class.new(Smalruby3::Sprite) do
      when_receive("go") do
        received = true
      end
    end
    target = klass.new(@runtime)

    # Simulate broadcast by starting hats
    handlers = klass._event_handlers[:broadcast_received]
    assert_equal 1, handlers.size
    assert_equal "go", handlers.first[0]
  end

  def test_when_key_pressed_registration
    klass = Class.new(Smalruby3::Sprite) do
      when_key_pressed("space") { }
      when_key_pressed("a") { }
    end
    handlers = klass._event_handlers[:key_pressed]
    assert_equal 2, handlers.size
    assert_equal "space", handlers[0][0]
    assert_equal "a", handlers[1][0]
  end

  def test_scancode_to_scratch_name
    kb = Smalruby3::IO::Keyboard.new
    assert_equal "space", kb.scancode_to_scratch_name(44)
    assert_equal "left arrow", kb.scancode_to_scratch_name(80)
    assert_equal "a", kb.scancode_to_scratch_name(4)
    assert_equal "0", kb.scancode_to_scratch_name(39)
  end
end
