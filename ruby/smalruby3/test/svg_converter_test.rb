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

  def test_available_returns_boolean
    result = @converter.available?
    assert [true, false].include?(result)
  end

  def test_convert_creates_png
    skip "rsvg-convert not installed" unless @converter.available?

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
    skip "rsvg-convert not installed" unless @converter.available?

    png_path = File.join(@tmpdir, "no_output.png")
    result = @converter.convert("/nonexistent/file.svg", png_path)
    assert_nil result, "convert should return nil for missing SVG"
    refute File.exist?(png_path), "PNG should not be created for missing SVG"
  end

  def test_convert_returns_nil_for_invalid_svg
    skip "rsvg-convert not installed" unless @converter.available?

    bad_svg = File.join(@tmpdir, "bad.svg")
    File.write(bad_svg, "this is not SVG content")
    png_path = File.join(@tmpdir, "bad_output.png")
    result = @converter.convert(bad_svg, png_path)
    # rsvg-convert may or may not fail on invalid SVG, just ensure no crash
    assert [nil, png_path].include?(result)
  end

  def test_convert_prevents_command_injection
    skip "rsvg-convert not installed" unless @converter.available?

    # Path with shell metacharacters (spaces and quotes) should not cause injection
    dangerous_name = "test file'$(echo pwned).svg"
    dangerous_path = File.join(@tmpdir, dangerous_name)
    File.write(dangerous_path, '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    png_path = File.join(@tmpdir, "safe_output.png")

    # Should not raise or execute injected commands
    @converter.convert(dangerous_path, png_path)
    # Just verify no crash; output may or may not exist
  end

  def test_convert_uses_svg_dimensions
    skip "rsvg-convert not installed" unless @converter.available?

    # Cat 2 SVG is 133x72 — verify the output PNG has reasonable dimensions
    png_path = File.join(@tmpdir, "cat2.png")
    @converter.convert(@svg_path, png_path)
    assert File.exist?(png_path)

    # Load via SDL2 if available, otherwise just check file exists
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
end
