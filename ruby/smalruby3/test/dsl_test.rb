# frozen_string_literal: true

require "test_helper"

class DSLTest < Minitest::Test
  def test_sprite_set_x
    klass = Class.new(Smalruby3::Sprite) do
      set_x 100
      set_y(-50)
    end
    assert_equal 100, klass._initial_x
    assert_equal(-50, klass._initial_y)
  end

  def test_sprite_set_direction
    klass = Class.new(Smalruby3::Sprite) do
      set_direction 180
    end
    assert_equal 180, klass._initial_direction
  end

  def test_sprite_defaults
    klass = Class.new(Smalruby3::Sprite)
    assert_equal 0, klass._initial_x
    assert_equal 0, klass._initial_y
    assert_equal 90, klass._initial_direction
    assert_equal 100, klass._initial_size
    assert_equal true, klass._initial_visible
    assert_equal "all around", klass._initial_rotation_style
  end

  def test_sprite_set_sprite
    klass = Class.new(Smalruby3::Sprite) do
      set_sprite "Shimaraby"
    end
    assert_equal "Shimaraby", klass._sprite_name
  end

  def test_when_flag_clicked_registers_handler
    handler_called = false
    klass = Class.new(Smalruby3::Sprite) do
      when_flag_clicked do
        handler_called = true
      end
    end
    assert_equal 1, klass._event_handlers[:flag_clicked].size
    assert_kind_of Proc, klass._event_handlers[:flag_clicked].first
  end

  def test_when_key_pressed_registers_handler
    klass = Class.new(Smalruby3::Sprite) do
      when_key_pressed("space") do
        # noop
      end
    end
    handlers = klass._event_handlers[:key_pressed]
    assert_equal 1, handlers.size
    assert_equal "space", handlers.first[0]
  end

  def test_stage_set_backdrops
    Smalruby3::Runtime.instance.reset_stage_class!
    klass = Class.new(Smalruby3::Stage) do
      set_backdrops ["Arctic", "Blue Sky"]
    end
    assert_equal ["Arctic", "Blue Sky"], klass._backdrop_names
    Smalruby3::Runtime.instance.reset_stage_class!
  end
end
