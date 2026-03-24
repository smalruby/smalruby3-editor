# frozen_string_literal: true

module Smalruby3
  class Sprite < Target
    extend DSL::SpriteClassMethods

    attr_accessor :x, :y, :direction, :size, :rotation_style

    def self.inherited(subclass)
      super
      Smalruby3.register_sprite(subclass)
    end

    def initialize(runtime)
      super
      @x = self.class._initial_x
      @y = self.class._initial_y
      @direction = self.class._initial_direction
      @size = self.class._initial_size
      @rotation_style = self.class._initial_rotation_style
      @current_costume = self.class._initial_costume

      # Load costumes from asset directory
      sprite_name = self.class._sprite_name
      @costumes = if sprite_name
                    Costume.load_for_sprite(sprite_name)
                  else
                    []
                  end
    end

    def move(steps)
      radians = (@direction - 90) * Math::PI / 180.0
      self.x += steps * Math.cos(radians)
      self.y -= steps * Math.sin(radians)
    end

    def turn_right(degrees)
      @direction = (@direction + degrees) % 360
    end

    def turn_left(degrees)
      @direction = (@direction - degrees) % 360
    end

    def go_to(target)
      case target
      when "_mouse_"
        @x = mouse.x
        @y = mouse.y
      when "_random_"
        @x = rand(-240..240)
        @y = rand(-180..180)
      when Array
        @x = target[0]
        @y = target[1]
      when String
        other = sprite(target)
        if other
          @x = other.x
          @y = other.y
        end
      end
    end

    def show
      @visible = true
    end

    def hide
      @visible = false
    end
  end
end
