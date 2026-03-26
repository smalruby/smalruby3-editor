# frozen_string_literal: true

require "test_helper"

class MonitorRendererTest < Minitest::Test
  def test_format_value_integer
    mr = Smalruby3::Render::MonitorRenderer.new(nil)
    assert_equal "42", mr.send(:format_value, 42)
  end

  def test_format_value_float_whole
    mr = Smalruby3::Render::MonitorRenderer.new(nil)
    assert_equal "5", mr.send(:format_value, 5.0)
  end

  def test_format_value_float_decimal
    mr = Smalruby3::Render::MonitorRenderer.new(nil)
    assert_equal "3.14", mr.send(:format_value, 3.14159)
  end

  def test_format_value_nil
    mr = Smalruby3::Render::MonitorRenderer.new(nil)
    assert_equal "0", mr.send(:format_value, nil)
  end

  def test_format_value_string
    mr = Smalruby3::Render::MonitorRenderer.new(nil)
    assert_equal "hello", mr.send(:format_value, "hello")
  end

  def test_format_label_stage
    mr = Smalruby3::Render::MonitorRenderer.new(nil)
    stage = Smalruby3::Stage.new(Smalruby3::Runtime.instance)
    assert_equal "score", mr.send(:format_label, stage, "@score")
  end

  def test_monitors_attr_reader
    target = Smalruby3::Target.new(Smalruby3::Runtime.instance)
    assert_equal({}, target.monitors)

    target.show_variable("@score")
    assert_equal :visible, target.monitors["@score"]

    target.hide_variable("@score")
    assert_equal :hidden, target.monitors["@score"]
  end

  def test_show_hide_list
    target = Smalruby3::Target.new(Smalruby3::Runtime.instance)
    target.show_list("items")
    assert_equal :visible, target.monitors["list:items"]

    target.hide_list("items")
    assert_equal :hidden, target.monitors["list:items"]
  end
end
