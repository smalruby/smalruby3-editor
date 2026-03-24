# frozen_string_literal: true

module Smalruby3
  class Sprite < Target
    extend DSL::SpriteClassMethods

    attr_accessor :x, :y, :direction, :size, :rotation_style
    attr_reader :costumes

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

      sprite_name = self.class._sprite_name
      @costumes = if sprite_name
                    Costume.load_for_sprite(sprite_name)
                  else
                    []
                  end
    end

    # --- Motion ---

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
        @x = mouse.x.to_f
        @y = mouse.y.to_f
      when "_random_"
        @x = rand(-240..240).to_f
        @y = rand(-180..180).to_f
      when Array
        @x = target[0].to_f
        @y = target[1].to_f
      when String
        other = sprite(target)
        if other
          @x = other.x.to_f
          @y = other.y.to_f
        end
      end
    end

    def glide(target, secs:)
      dest_x, dest_y = resolve_position(target)
      return unless dest_x

      start_x = @x
      start_y = @y
      frames = (secs.to_f * Runtime::FPS).ceil
      frames = 1 if frames < 1

      frames.times do |i|
        t = (i + 1).to_f / frames
        @x = start_x + (dest_x - start_x) * t
        @y = start_y + (dest_y - start_y) * t
        Fiber.yield
      end
      @x = dest_x
      @y = dest_y
    end

    def point_towards(target)
      case target
      when "_mouse_"
        dx = mouse.x - @x
        dy = mouse.y - @y
      when String
        other = sprite(target)
        return unless other
        dx = other.x - @x
        dy = other.y - @y
      else
        return
      end
      @direction = (90 - Math.atan2(dy, dx) * 180.0 / Math::PI) % 360
    end

    def bounce_if_on_edge
      costume = current_costume_obj
      return unless costume

      scale = @size / 100.0
      w = costume.width * scale / 2.0
      h = costume.height * scale / 2.0

      bounced = false
      if @x + w > 240
        @x = 240 - w
        @direction = 360 - @direction if @direction > 180 && @direction < 360
        bounced = true
      elsif @x - w < -240
        @x = -240 + w
        @direction = 360 - @direction if @direction > 0 && @direction < 180
        bounced = true
      end
      if @y + h > 180
        @y = 180 - h
        @direction = 180 - @direction
        bounced = true
      elsif @y - h < -180
        @y = -180 + h
        @direction = 180 - @direction
        bounced = true
      end
      @direction %= 360 if bounced
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

    private

    def resolve_position(target)
      case target
      when "_mouse_"
        [mouse.x.to_f, mouse.y.to_f]
      when "_random_"
        [rand(-240..240).to_f, rand(-180..180).to_f]
      when Array
        [target[0].to_f, target[1].to_f]
      when String
        other = sprite(target)
        other ? [other.x.to_f, other.y.to_f] : nil
      end
    end

    def touching_edge?
      costume = current_costume_obj
      return false unless costume
      scale = @size / 100.0
      w = costume.width * scale / 2.0
      h = costume.height * scale / 2.0
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
