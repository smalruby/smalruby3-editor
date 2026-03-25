# frozen_string_literal: true

require "singleton"

module Smalruby3
  class Runtime
    include Singleton

    STAGE_WIDTH = 480
    STAGE_HEIGHT = 360
    FPS = 30
    FRAME_TIME = 1.0 / FPS
    MAX_CLONES = 300

    attr_reader :keyboard, :mouse, :clock, :renderer, :sequencer
    attr_reader :stage, :sprites
    attr_accessor :answer

    def initialize
      @sprite_classes = []
      @stage_class = nil
      @sprites = []
      @stage = nil
      @sequencer = Sequencer.new(self)
      @keyboard = IO::Keyboard.new
      @mouse = IO::Mouse.new
      @clock = IO::Clock.new
      @renderer = nil
      @running = false
      @answer = ""
      @clone_count = 0
      @edge_activated_values = {}
    end

    def register_sprite(klass)
      @sprite_classes << klass
    end

    def register_stage(klass)
      if @stage_class && @stage_class != klass
        raise "Only one Stage class can be defined (already registered: #{@stage_class})"
      end
      @stage_class = klass
    end

    # For testing: reset stage registration
    def reset_stage_class!
      @stage_class = nil
    end

    def find_target(name)
      return @stage if name == "_stage_" || name == "Stage"
      @sprites.find { |s| s.name == name }
    end

    def run
      init_targets
      init_renderer
      start_flag_clicked
      main_loop
    ensure
      shutdown
    end

    # --- Event Triggers (public for Target access) ---

    def broadcast(message)
      start_hats(:broadcast_received, message)
    end

    def broadcast_and_wait(message)
      fibers = start_hats(:broadcast_received, message)
      # Yield until all started fibers are done
      Fiber.yield until fibers.all?(&:done?)
    end

    def start_hats(event_type, *match_args)
      started = []
      all_targets.each do |target|
        handlers = target.class._event_handlers[event_type]
        next unless handlers

        handlers.each do |handler_data|
          case event_type
          when :broadcast_received
            msg, block = handler_data
            next unless msg == match_args[0]
            started << @sequencer.start_script(target, &block)
          when :key_pressed
            key, block = handler_data
            next unless key == match_args[0] || key == "any"
            started << @sequencer.start_script(target, &block)
          when :clicked
            started << @sequencer.start_script(target, &handler_data)
          when :backdrop_switches
            name, block = handler_data
            next unless name == match_args[0]
            started << @sequencer.start_script(target, &block)
          when :clone_start
            # Only fire on the clone target itself
            next unless target == match_args[0]
            started << @sequencer.start_script(target, &handler_data)
          when :greater_than
            # handler_data: [type, threshold, block]
            started << @sequencer.start_script(target, &handler_data[2])
          end
        end
      end
      started
    end

    # --- Clone Management ---

    def create_clone(source_sprite, requester)
      return nil if @clone_count >= MAX_CLONES

      # Find source
      source = if source_sprite == "_myself_"
                 requester
               else
                 find_target(source_sprite)
               end
      return nil unless source.is_a?(Sprite)

      clone = source.make_clone(self)
      return nil unless clone

      @sprites << clone
      @clone_count += 1
      start_hats(:clone_start, clone)
      clone
    end

    def delete_clone(clone)
      return unless clone.clone?
      @sprites.delete(clone)
      @sequencer.stop_target_scripts(clone)
      @clone_count -= 1
      @renderer&.remove_sprite(clone)
    end

    # --- Layer Management ---

    def move_sprite_to_front(sprite)
      @sprites.delete(sprite)
      @sprites.push(sprite)
    end

    def move_sprite_to_back(sprite)
      @sprites.delete(sprite)
      @sprites.unshift(sprite)
    end

    def move_sprite_forward(sprite, layers)
      idx = @sprites.index(sprite)
      return unless idx
      @sprites.delete_at(idx)
      new_idx = [idx + layers, @sprites.size].min
      @sprites.insert(new_idx, sprite)
    end

    def move_sprite_backward(sprite, layers)
      idx = @sprites.index(sprite)
      return unless idx
      @sprites.delete_at(idx)
      new_idx = [idx - layers, 0].max
      @sprites.insert(new_idx, sprite)
    end

    private

    def init_targets
      @stage = if @stage_class
                 @stage_class.new(self)
               else
                 Stage.new(self)
               end

      @sprite_classes.each do |klass|
        sprite = klass.new(self)
        @sprites << sprite
      end
    end

    def init_renderer
      @renderer = Render::Renderer.new(STAGE_WIDTH, STAGE_HEIGHT)
    end

    def start_flag_clicked
      all_targets.each do |target|
        target.class._event_handlers[:flag_clicked]&.each do |handler|
          @sequencer.start_script(target, &handler)
        end
      end
    end

    def main_loop
      @running = true
      while @running
        frame_start = Time.now

        process_events
        check_edge_activated_hats
        @sequencer.step_fibers
        render

        elapsed = Time.now - frame_start
        remaining = FRAME_TIME - elapsed
        sleep(remaining) if remaining > 0
      end
    end

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
      mx >= left && mx <= right && my >= bottom && my <= top
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

    def render
      @renderer.begin_frame
      @renderer.draw_stage(@stage) if @stage
      @renderer.pen_skin&.render_to(@renderer.instance_variable_get(:@sdl_renderer))
      @sprites.each { |s| @renderer.draw_sprite(s) if s.visible }
      @renderer.end_frame
    end

    def shutdown
      @renderer&.destroy
    end

    def all_targets
      targets = []
      targets << @stage if @stage
      targets.concat(@sprites)
      targets
    end
  end
end
