# frozen_string_literal: true

module Smalruby3
  class Sprite < Target
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
      w = costume.display_width * scale / 2.0
      h = costume.display_height * scale / 2.0

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
  end
end
