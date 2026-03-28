# frozen_string_literal: true

module Smalruby3
  class List
    def initialize(items = [])
      @items = items.dup
    end

    def push(value)
      @items.push(value)
    end

    def delete_at(index)
      @items.delete_at(index)
    end

    def clear
      @items.clear
    end

    def insert(index, value)
      @items.insert(index, value)
    end

    def [](index)
      @items[index]
    end

    def []=(index, value)
      @items[index] = value
    end

    def index(value)
      @items.index(value)
    end

    def length
      @items.length
    end

    def include?(value)
      @items.any? { |item| item.to_s.downcase == value.to_s.downcase }
    end

    def to_s
      @items.join(" ")
    end

    def to_a
      @items.dup
    end
  end
end
