# frozen_string_literal: true

require "test_helper"

class ClockTest < Minitest::Test
  def test_value_increases
    clock = Smalruby3::IO::Clock.new
    v1 = clock.value
    sleep 0.01
    v2 = clock.value
    assert v2 > v1
  end

  def test_reset
    clock = Smalruby3::IO::Clock.new
    sleep 0.01
    clock.reset
    assert clock.value < 0.05
  end
end
