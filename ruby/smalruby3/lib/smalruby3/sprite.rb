# frozen_string_literal: true

module Smalruby3
  class Sprite < Target
    extend DSL::SpriteClassMethods

    attr_reader :x, :y, :costumes
    attr_accessor :direction, :size, :rotation_style

    def x=(value)
      @x = value.to_f
      @pen&.on_move
    end

    def y=(value)
      @y = value.to_f
      @pen&.on_move
    end

    def self.inherited(subclass)
      super
      Smalruby3.register_sprite(subclass)
    end

    def initialize(runtime)
      super
      @x = self.class._initial_x.to_f
      @y = self.class._initial_y.to_f
      @direction = self.class._initial_direction.to_f
      @size = self.class._initial_size.to_f
      @rotation_style = self.class._initial_rotation_style
      @current_costume = self.class._initial_costume
      @is_clone = false
      @drag_mode = "not draggable"

      am = @runtime.asset_manager
      sprite_name = self.class._sprite_name
      @costumes = if sprite_name
        am.resolve_costumes(sprite_name)
      elsif self.class._costume_names.any?
        am.resolve_costumes_by_name(self.class._costume_names)
      else
        []
      end

      @sounds = if sprite_name
        am.resolve_sounds(sprite_name)
      elsif self.class._sound_names.any?
        am.resolve_sounds_by_name(self.class._sound_names)
      else
        []
      end
    end

    # --- Looks ---

    def switch_costume(name)
      idx = @costumes.index { |c| c.name == name.to_s }
      @current_costume = idx if idx
    end

    def next_costume
      @current_costume = (@current_costume + 1) % [@costumes.size, 1].max
    end

    def costume_number
      @current_costume + 1
    end

    def costume_name
      @costumes[@current_costume]&.name || ""
    end

    def current_costume_obj
      @costumes[@current_costume]
    end

    def show
      @visible = true
    end

    def hide
      @visible = false
    end

    def go_to_layer(position)
      case position
      when "front"
        @runtime.move_sprite_to_front(self)
      when "back"
        @runtime.move_sprite_to_back(self)
      end
    end

    def go_layers(n, direction)
      case direction
      when "forward"
        @runtime.move_sprite_forward(self, n)
      when "backward"
        @runtime.move_sprite_backward(self, n)
      end
    end

    # --- Looks (backdrop delegation to Stage) ---

    def backdrop_number
      stage.backdrop_number
    end

    def backdrop_name
      stage.backdrop_name
    end

    def switch_backdrop(name)
      stage.switch_backdrop(name)
    end

    def switch_backdrop_and_wait(name)
      stage.switch_backdrop_and_wait(name)
    end

    def next_backdrop
      stage.next_backdrop
    end

    # --- Extensions ---

    def pen
      @pen ||= Extension::Pen.new(self)
    end

    def music
      @music ||= Extension::Music.new(self)
    end

    # --- Sensing ---

    def touching?(target)
      case target
      when "_edge_"
        touching_edge?
      when "_mouse_"
        touching_point?(mouse.x, mouse.y)
      when String
        other = sprite(target)
        return false unless other
        touching_sprite?(other)
      else
        false
      end
    end

    def touching_color?(color)
      rgb = Render::ColorUtil.hex_to_rgb(color)
      Render::Collision.sprite_touching_color?(self, rgb, @runtime.sprites, @runtime.stage)
    end

    def color_is_touching_color?(color1, color2)
      mask_rgb = Render::ColorUtil.hex_to_rgb(color1)
      target_rgb = Render::ColorUtil.hex_to_rgb(color2)
      Render::Collision.color_touching_color?(self, mask_rgb, target_rgb, @runtime.sprites, @runtime.stage)
    end

    def distance(target)
      case target
      when "_mouse_"
        dx = mouse.x - @x
        dy = mouse.y - @y
      when String
        other = sprite(target)
        return 10_000 unless other
        dx = other.x - @x
        dy = other.y - @y
      else
        return 10_000
      end
      Math.sqrt(dx * dx + dy * dy)
    end

    attr_accessor :drag_mode

    private

    def touching_edge?
      costume = current_costume_obj
      return false unless costume
      scale = @size / 100.0
      w = costume.display_width * scale / 2.0
      h = costume.display_height * scale / 2.0
      @x + w > 240 || @x - w < -240 || @y + h > 180 || @y - h < -180
    end

    def touching_point?(px, py)
      Render::Collision.point_touching_sprite?(px, py, self)
    end

    def touching_sprite?(other)
      Render::Collision.sprites_touching?(self, other)
    end
  end
end

require_relative "sprite/motion"
require_relative "sprite/clone"
