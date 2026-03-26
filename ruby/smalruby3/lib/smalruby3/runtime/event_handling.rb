# frozen_string_literal: true

module Smalruby3
  class Runtime
    private

    def process_events
      @renderer.poll_events do |event|
        case event
        when :quit
          @running = false
        when Array
          type, *args = event
          case type
          when :key_down
            @keyboard.handle_key_down(args[0])
            trigger_key_pressed(args[0])
          when :key_up
            @keyboard.handle_key_up(args[0])
          when :mouse_motion
            @mouse.handle_motion(args[0], args[1])
          when :mouse_button_down
            @mouse.handle_button_down
            trigger_clicked
          when :mouse_button_up
            @mouse.handle_button_up
          end
        end
      end
    end

    def trigger_key_pressed(scancode)
      key_name = @keyboard.scancode_to_scratch_name(scancode)
      return unless key_name
      start_hats(:key_pressed, key_name)
    end

    def trigger_clicked
      # Check sprites in reverse order (top-most first)
      @sprites.reverse_each do |sprite|
        next unless sprite.visible
        if sprite_contains_mouse?(sprite)
          start_hats(:clicked)
          break
        end
      end
    end

    def sprite_contains_mouse?(sprite)
      # Simple AABB check
      costume = sprite.current_costume_obj
      return false unless costume

      scale = sprite.size / 100.0
      w = costume.width * scale
      h = costume.height * scale
      left = sprite.x - w / 2
      right = sprite.x + w / 2
      bottom = sprite.y - h / 2
      top = sprite.y + h / 2

      mx = @mouse.x
      my = @mouse.y
      mx.between?(left, right) && my >= bottom && my <= top
    end

    def check_edge_activated_hats
      all_targets.each do |target|
        handlers = target.class._event_handlers[:greater_than]
        next unless handlers

        handlers.each do |type, threshold, block|
          current_value = case type
          when "LOUDNESS" then 0 # Not implemented
          when "TIMER" then @clock.value
          else 0
          end
          key = [target.object_id, type]
          old_value = @edge_activated_values[key]
          @edge_activated_values[key] = current_value

          # Edge-activated: only trigger on transition from below to above
          if old_value && old_value <= threshold && current_value > threshold
            @sequencer.start_script(target, &block)
          end
        end
      end
    end
  end
end
