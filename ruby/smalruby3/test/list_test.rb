# frozen_string_literal: true

require "test_helper"

class ListTest < Minitest::Test
  def test_push_and_length
    list = Smalruby3::List.new
    list.push("apple")
    list.push("banana")
    assert_equal 2, list.length
  end

  def test_get_1_based
    list = Smalruby3::List.new(["a", "b", "c"])
    assert_equal "a", list[1]
    assert_equal "b", list[2]
    assert_equal "c", list[3]
  end

  def test_get_out_of_range
    list = Smalruby3::List.new(["a"])
    assert_equal "", list[0]
    assert_equal "", list[2]
  end

  def test_set_1_based
    list = Smalruby3::List.new(["a", "b", "c"])
    list[2] = "x"
    assert_equal "x", list[2]
  end

  def test_delete_at_1_based
    list = Smalruby3::List.new(["a", "b", "c"])
    list.delete_at(2)
    assert_equal 2, list.length
    assert_equal "a", list[1]
    assert_equal "c", list[2]
  end

  def test_delete_at_all
    list = Smalruby3::List.new(["a", "b", "c"])
    list.delete_at("all")
    assert_equal 0, list.length
  end

  def test_delete_at_last
    list = Smalruby3::List.new(["a", "b", "c"])
    list.delete_at("last")
    assert_equal 2, list.length
    assert_equal "b", list[2]
  end

  def test_insert_1_based
    list = Smalruby3::List.new(["a", "c"])
    list.insert(2, "b")
    assert_equal "a", list[1]
    assert_equal "b", list[2]
    assert_equal "c", list[3]
  end

  def test_insert_last
    list = Smalruby3::List.new(["a"])
    list.insert("last", "b")
    assert_equal "b", list[2]
  end

  def test_index_1_based
    list = Smalruby3::List.new(["apple", "banana", "cherry"])
    assert_equal 2, list.index("banana")
    assert_equal 0, list.index("grape") # 0 = not found
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
end
