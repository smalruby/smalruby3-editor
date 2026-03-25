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
      # Scratch uses 1-based index; "all" deletes everything; "last" deletes last
      case index
      when "all"
        @items.clear
      when "last"
        @items.pop
      else
        i = index.to_i - 1
        @items.delete_at(i) if i >= 0 && i < @items.size
      end
    end

    def clear
      @items.clear
    end

    def insert(index, value)
      # 1-based; "last" = append; "random" = random position
      case index
      when "last"
        @items.push(value)
      when "random"
        pos = @items.empty? ? 0 : rand(0..@items.size)
        @items.insert(pos, value)
      else
        i = index.to_i - 1
        i = i.clamp(0, @items.size)
        @items.insert(i, value)
      end
    end

    def [](index)
      i = index.to_i - 1 # 1-based
      return "" if i < 0 || i >= @items.size
      @items[i]
    end

    def []=(index, value)
      i = index.to_i - 1 # 1-based
      @items[i] = value if i >= 0 && i < @items.size
    end

    def index(value)
      idx = @items.index(value)
      idx ? idx + 1 : 0 # 1-based, 0 = not found
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
