# frozen_string_literal: true

require "test_helper"

class CollisionTest < Minitest::Test
  def test_world_to_texture_center
    sprite = make_sprite(x: 0, y: 0, direction: 90, size: 100, width: 32, height: 32)
    tx, ty = Smalruby3::Render::Collision.world_to_texture(0, 0, sprite)
    assert_in_delta 0.5, tx, 0.05
    assert_in_delta 0.5, ty, 0.05
  end

  def test_world_to_texture_offset
    sprite = make_sprite(x: 100, y: 50, direction: 90, size: 100, width: 32, height: 32)
    # Point at sprite position should be center
    tx, ty = Smalruby3::Render::Collision.world_to_texture(100, 50, sprite)
    assert_in_delta 0.5, tx, 0.05
    assert_in_delta 0.5, ty, 0.05
  end

  def test_world_to_texture_outside
    sprite = make_sprite(x: 0, y: 0, direction: 90, size: 100, width: 32, height: 32)
    result = Smalruby3::Render::Collision.world_to_texture(200, 200, sprite)
    assert_nil result
  end

  def test_world_to_texture_scaled
    sprite = make_sprite(x: 0, y: 0, direction: 90, size: 200, width: 32, height: 32)
    # At 200% scale, the sprite covers a larger area
    tx, _ = Smalruby3::Render::Collision.world_to_texture(16, 0, sprite)
    assert tx, "Should be within bounds at 200% scale"
    assert_in_delta 0.75, tx, 0.05
  end

  def test_sprite_bounds
    sprite = make_sprite(x: 100, y: -50, direction: 90, size: 100, width: 32, height: 32)
    bounds = Smalruby3::Render::Collision.sprite_bounds(sprite)
    assert_in_delta 84, bounds[:left], 1
    assert_in_delta 116, bounds[:right], 1
    assert_in_delta(-66, bounds[:bottom], 1)
    assert_in_delta(-34, bounds[:top], 1)
  end

  def test_sprite_bounds_scaled
    sprite = make_sprite(x: 0, y: 0, direction: 90, size: 200, width: 32, height: 32)
    bounds = Smalruby3::Render::Collision.sprite_bounds(sprite)
    assert_in_delta(-32, bounds[:left], 1)
    assert_in_delta(32, bounds[:right], 1)
  end

  private

  def make_sprite(x:, y:, direction:, size:, width:, height:)
    costume = Minitest::Mock.new
    costume.expect(:width, width)
    costume.expect(:height, height)
    costume.expect(:rotation_center_x, width / 2.0)
    costume.expect(:rotation_center_y, height / 2.0)
    # May be called multiple times
    5.times do
      costume.expect(:width, width)
      costume.expect(:height, height)
      costume.expect(:rotation_center_x, width / 2.0)
      costume.expect(:rotation_center_y, height / 2.0)
    end

    sprite = Minitest::Mock.new
    sprite.expect(:x, x.to_f)
    sprite.expect(:y, y.to_f)
    sprite.expect(:direction, direction.to_f)
    sprite.expect(:size, size.to_f)
    sprite.expect(:current_costume_obj, costume)
    # May be called multiple times
    5.times do
      sprite.expect(:x, x.to_f)
      sprite.expect(:y, y.to_f)
      sprite.expect(:direction, direction.to_f)
      sprite.expect(:size, size.to_f)
      sprite.expect(:current_costume_obj, costume)
    end
    sprite
  end
end
