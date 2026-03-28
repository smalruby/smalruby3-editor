# frozen_string_literal: true

require "test_helper"

class ListTest < Minitest::Test
  def test_push_and_length
    list = Smalruby3::List.new
    list.push("apple")
    list.push("banana")
    assert_equal 2, list.length
  end

  def test_get_0_based
    list = Smalruby3::List.new(["a", "b", "c"])
    assert_equal "a", list[0]
    assert_equal "b", list[1]
    assert_equal "c", list[2]
  end

  def test_get_negative_index
    list = Smalruby3::List.new(["a", "b", "c"])
    assert_equal "c", list[-1]
    assert_equal "b", list[-2]
  end

  def test_get_out_of_range
    list = Smalruby3::List.new(["a"])
    assert_nil list[3]
    assert_nil list[-3]
  end

  def test_set_0_based
    list = Smalruby3::List.new(["a", "b", "c"])
    list[1] = "x"
    assert_equal "x", list[1]
  end

  def test_set_negative_index
    list = Smalruby3::List.new(["a", "b", "c"])
    list[-1] = "z"
    assert_equal "z", list[2]
  end

  def test_delete_at_0_based
    list = Smalruby3::List.new(["a", "b", "c"])
    list.delete_at(1)
    assert_equal 2, list.length
    assert_equal "a", list[0]
    assert_equal "c", list[1]
  end

  def test_delete_at_negative
    list = Smalruby3::List.new(["a", "b", "c"])
    list.delete_at(-1)
    assert_equal 2, list.length
    assert_equal "b", list[1]
  end

  def test_insert_0_based
    list = Smalruby3::List.new(["a", "c"])
    list.insert(1, "b")
    assert_equal "a", list[0]
    assert_equal "b", list[1]
    assert_equal "c", list[2]
  end

  def test_index_0_based
    list = Smalruby3::List.new(["apple", "banana", "cherry"])
    assert_equal 1, list.index("banana")
    assert_nil list.index("grape")
  end

  def test_include_case_insensitive
    list = Smalruby3::List.new(["Apple", "banana"])
    assert list.include?("apple")
    assert list.include?("BANANA")
    refute list.include?("cherry")
  end

  def test_clear
    list = Smalruby3::List.new(["a", "b"])
    list.clear
    assert_equal 0, list.length
  end

  def test_to_s
    list = Smalruby3::List.new(["hello", "world"])
    assert_equal "hello world", list.to_s
  end

  def test_to_a
    list = Smalruby3::List.new(["a", "b"])
    assert_equal ["a", "b"], list.to_a
  end
end
