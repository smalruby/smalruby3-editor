# frozen_string_literal: true

require "test_helper"

class AssetManagerTest < Minitest::Test
  def setup
    @am = Smalruby3::AssetManager.new
  end

  def test_resolve_costumes_for_shimaraby
    costumes = @am.resolve_costumes("Shimaraby")
    assert_equal 2, costumes.size
    assert_equal "Shimaraby-a", costumes[0].name
    assert_equal "Shimaraby-b", costumes[1].name
    # Preset assets should resolve without download
    assert costumes.all? { |c| c.path && File.exist?(c.path) }
  end

  def test_resolve_costumes_for_shimacat
    costumes = @am.resolve_costumes("Shimacat")
    assert_equal 2, costumes.size
    assert_equal "Shimacat-a", costumes[0].name
    assert_equal "Shimacat-b", costumes[1].name
    assert costumes.all? { |c| c.path && File.exist?(c.path) }
  end

  def test_resolve_costumes_for_cat_2
    costumes = @am.resolve_costumes("Cat 2")
    assert_equal 1, costumes.size
    assert_equal "cat 2", costumes[0].name
    assert costumes[0].path && File.exist?(costumes[0].path)
  end

  def test_resolve_sounds_for_shimaraby
    sounds = @am.resolve_sounds("Shimaraby")
    assert_equal 1, sounds.size
    assert_equal "Chirp", sounds[0].name
    assert sounds[0].path && File.exist?(sounds[0].path)
  end

  def test_resolve_sounds_for_shimacat
    sounds = @am.resolve_sounds("Shimacat")
    assert_equal 1, sounds.size
    assert_equal "Meow", sounds[0].name
    assert sounds[0].path && File.exist?(sounds[0].path)
  end

  def test_resolve_sounds_for_cat_2
    sounds = @am.resolve_sounds("Cat 2")
    assert_equal 1, sounds.size
    assert_equal "meow2", sounds[0].name
    assert sounds[0].path && File.exist?(sounds[0].path)
  end

  def test_resolve_costumes_unknown_sprite
    costumes = @am.resolve_costumes("NonExistentSprite")
    assert_empty costumes
  end

  def test_resolve_sounds_unknown_sprite
    sounds = @am.resolve_sounds("NonExistentSprite")
    assert_empty sounds
  end

  def test_bitmap_resolution_shimaraby
    costumes = @am.resolve_costumes("Shimaraby")
    assert_equal 2, costumes[0].bitmap_resolution
  end

  def test_bitmap_resolution_cat_2
    costumes = @am.resolve_costumes("Cat 2")
    assert_equal 1, costumes[0].bitmap_resolution
  end

  def test_resolve_costumes_by_name
    costumes = @am.resolve_costumes_by_name(["Shimaraby-a"])
    assert_equal 1, costumes.size
    assert_equal "Shimaraby-a", costumes[0].name
  end

  def test_resolve_sounds_by_name
    sounds = @am.resolve_sounds_by_name(["Chirp"])
    assert_equal 1, sounds.size
    assert_equal "Chirp", sounds[0].name
  end
end
