# frozen_string_literal: true

require "test_helper"
require "tmpdir"
require "fileutils"

class SvgConverterTest < Minitest::Test
  def setup
    @converter = Smalruby3::AssetManager::SvgConverter
    @svg_path = File.expand_path("../assets/preset/7499cf6ec438d0c7af6f896bc6adc294.svg", __dir__)
    @tmpdir = Dir.mktmpdir("svg_converter_test")
  end

  def teardown
    FileUtils.remove_entry(@tmpdir)
  end

  def test_available_returns_true
    assert @converter.available?
  end

  def test_convert_creates_png
    png_path = File.join(@tmpdir, "test_output.png")
    result = @converter.convert(@svg_path, png_path)
    assert result, "convert should return truthy on success"
    assert File.exist?(png_path), "PNG file should be created"
    assert File.size(png_path) > 0, "PNG file should not be empty"

    # Verify it's actually a PNG (magic bytes)
    magic = File.binread(png_path, 4)
    assert_equal "\x89PNG".b, magic, "Output should be a valid PNG file"
  end

  def test_convert_returns_nil_for_nonexistent_svg
    png_path = File.join(@tmpdir, "no_output.png")
    result = @converter.convert("/nonexistent/file.svg", png_path)
    assert_nil result, "convert should return nil for missing SVG"
    refute File.exist?(png_path), "PNG should not be created for missing SVG"
  end

  def test_convert_returns_nil_for_invalid_svg
    bad_svg = File.join(@tmpdir, "bad.svg")
    File.write(bad_svg, "this is not SVG content")
    png_path = File.join(@tmpdir, "bad_output.png")
    result = @converter.convert(bad_svg, png_path)
    assert_nil result, "convert should return nil for invalid SVG"
  end

  def test_convert_uses_svg_dimensions
    png_path = File.join(@tmpdir, "cat2.png")
    @converter.convert(@svg_path, png_path)
    assert File.exist?(png_path)

    surface = SDL2::Surface.load(png_path)
    assert surface.w > 0, "PNG width should be positive"
    assert surface.h > 0, "PNG height should be positive"
    surface.destroy
  end

  def test_png_path_for
    md5ext = "abc123def456.svg"
    result = @converter.png_path_for(md5ext)
    assert_equal "abc123def456.png", result
  end

  def test_png_path_for_non_svg
    md5ext = "abc123def456.png"
    result = @converter.png_path_for(md5ext)
    assert_nil result
  end

  def test_resvg_convert_bytes
    svg_data = File.binread(@svg_path)
    png_data = Smalruby3::Resvg.convert_bytes(svg_data)
    assert png_data.is_a?(String), "convert_bytes should return a String"
    assert png_data.bytesize > 0, "PNG data should not be empty"
    assert_equal "\x89PNG".b, png_data.byteslice(0, 4), "Output should be valid PNG"
  end
end
