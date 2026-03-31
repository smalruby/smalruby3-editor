# frozen_string_literal: true

require "test_helper"

class FontSupportTest < Minitest::Test
  # Use a test class that includes the module
  class TestIncluder
    include Smalruby3::Render::FontSupport
  end

  def test_module_exists
    assert_kind_of Module, Smalruby3::Render::FontSupport
  end

  def test_find_font_returns_string_or_nil
    obj = TestIncluder.new
    result = obj.send(:find_font)
    assert result.nil? || result.is_a?(String)
  end

  def test_find_font_returns_existing_file
    obj = TestIncluder.new
    result = obj.send(:find_font)
    assert File.exist?(result), "font path should exist" if result
  end

  def test_fill_circle_is_defined
    obj = TestIncluder.new
    assert obj.respond_to?(:fill_circle, true)
  end

  def test_text_bubble_includes_font_support
    assert Smalruby3::Render::TextBubble.ancestors.include?(Smalruby3::Render::FontSupport)
  end

  def test_monitor_renderer_includes_font_support
    assert Smalruby3::Render::MonitorRenderer.ancestors.include?(Smalruby3::Render::FontSupport)
  end
end
