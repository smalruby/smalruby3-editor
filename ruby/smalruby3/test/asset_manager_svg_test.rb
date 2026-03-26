# frozen_string_literal: true

require "test_helper"

class AssetManagerSvgTest < Minitest::Test
  def setup
    @am = Smalruby3::AssetManager.new
  end

  def test_resolve_costumes_for_cat_2_returns_png_path
    costumes = @am.resolve_costumes("Cat 2")
    assert_equal 1, costumes.size
    costume = costumes[0]
    assert_equal "cat 2", costume.name
    # SVG should be converted to PNG
    assert costume.path.end_with?(".png"), "SVG costume should be resolved to PNG path: #{costume.path}"
    assert File.exist?(costume.path), "Converted PNG should exist"
  end

  def test_svg_costume_surface_loads_successfully
    costumes = @am.resolve_costumes("Cat 2")
    costume = costumes[0]
    surface = costume.surface
    assert surface, "Surface should load from converted PNG"
    assert surface.w > 0, "Surface width should be positive"
    assert surface.h > 0, "Surface height should be positive"
  end

  def test_svg_conversion_is_cached
    # First resolve
    costumes1 = @am.resolve_costumes("Cat 2")
    path1 = costumes1[0].path

    # Second resolve should use cache
    am2 = Smalruby3::AssetManager.new
    costumes2 = am2.resolve_costumes("Cat 2")
    path2 = costumes2[0].path

    assert_equal path1, path2, "Cached path should be the same"
  end

  def test_resolve_costumes_by_name_svg
    costumes = @am.resolve_costumes_by_name(["cat 2"])
    assert_equal 1, costumes.size
    assert costumes[0].path.end_with?(".png"), "SVG costume resolved by name should be PNG"
  end
end
