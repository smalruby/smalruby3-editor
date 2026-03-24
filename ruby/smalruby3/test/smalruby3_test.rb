# frozen_string_literal: true

require "test_helper"

class Smalruby3Test < Minitest::Test
  def test_version
    refute_nil Smalruby3::VERSION
  end

  def test_not_started_by_default
    refute Smalruby3.started?
  end
end
