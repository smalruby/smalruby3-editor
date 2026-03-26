# frozen_string_literal: true

module Smalruby3
  class Sprite < Target
    # --- Clone ---

    def create_clone(target)
      @runtime.create_clone(target, self)
    end

    def delete_this_clone
      @runtime.delete_clone(self)
      raise StopThisScript
    end

    def clone?
      @is_clone
    end

    def make_clone(runtime)
      clone = self.class.allocate
      clone.instance_variable_set(:@runtime, runtime)
      clone.instance_variable_set(:@name, @name)
      clone.instance_variable_set(:@visible, @visible)
      clone.instance_variable_set(:@x, @x)
      clone.instance_variable_set(:@y, @y)
      clone.instance_variable_set(:@direction, @direction)
      clone.instance_variable_set(:@size, @size)
      clone.instance_variable_set(:@rotation_style, @rotation_style)
      clone.instance_variable_set(:@current_costume, @current_costume)
      clone.instance_variable_set(:@costumes, @costumes) # Shared
      clone.instance_variable_set(:@is_clone, true)
      clone.instance_variable_set(:@say_text, nil)
      clone.instance_variable_set(:@think_text, nil)
      clone.instance_variable_set(:@effects, @effects.dup)
      clone.instance_variable_set(:@volume, @volume)
      clone.instance_variable_set(:@sounds, @sounds) # Shared
      clone.instance_variable_set(:@monitors, {})
      clone.instance_variable_set(:@drag_mode, @drag_mode)
      clone
    end
  end
end
