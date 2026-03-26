# frozen_string_literal: true

module Smalruby3
  class Target
    attr_reader :runtime, :name
    attr_accessor :visible

    def initialize(runtime)
      @runtime = runtime
      @name = if self.class.respond_to?(:_name)
        self.class._name || self.class.name&.split("::")&.last || "unnamed"
      else
        self.class.name&.split("::")&.last || "unnamed"
      end
      @visible = self.class.respond_to?(:_initial_visible) ? self.class._initial_visible : true
      @say_text = nil
      @think_text = nil
      @effects = {}
      @volume = 100
      @sounds = []
      @monitors = {}
    end

    # --- IO Accessors ---

    def keyboard
      @runtime.keyboard
    end

    def mouse
      @runtime.mouse
    end

    def timer
      @runtime.clock
    end

    def sprite(name)
      @runtime.find_target(name)
    end

    def stage
      @runtime.stage
    end

    def answer
      @runtime.answer
    end

    # --- Events ---

    def broadcast(message)
      @runtime.broadcast(message)
    end

    def broadcast_and_wait(message)
      @runtime.broadcast_and_wait(message)
    end

    # --- Control ---

    def stop(target)
      case target
      when "all"
        @runtime.sequencer.stop_all
        raise StopAll
      when "this script"
        raise StopThisScript
      when "other scripts in sprite"
        @runtime.sequencer.stop_target_scripts(self)
      end
    end

    def sleep(seconds)
      frames = (seconds.to_f * Runtime::FPS).ceil
      frames.times { Fiber.yield }
    end

    # --- Looks ---

    def say(message, seconds = nil)
      @say_text = message.to_s
      @think_text = nil
      if seconds
        sleep(seconds)
        @say_text = nil
      end
    end

    def think(message, seconds = nil)
      @think_text = message.to_s
      @say_text = nil
      if seconds
        sleep(seconds)
        @think_text = nil
      end
    end

    attr_reader :say_text, :think_text

    def set_effect(effect, value)
      @effects[effect] = value
    end

    def change_effect_by(effect, amount)
      @effects[effect] = (@effects[effect] || 0) + amount
    end

    def clear_graphic_effects
      @effects.clear
    end

    attr_reader :effects, :volume

    def volume=(value)
      @volume = value.clamp(0, 100)
    end

    # --- Sound ---

    def play(sound_name)
      sound = find_sound(sound_name)
      return unless sound
      chunk = sound.chunk
      return unless chunk
      SDL2::Mixer::Channels.play(-1, chunk, 0)
    rescue => e
      warn "[Smalruby3] play error: #{e.message}"
    end

    def play_until_done(sound_name)
      sound = find_sound(sound_name)
      return unless sound
      chunk = sound.chunk
      return unless chunk
      channel = SDL2::Mixer::Channels.play(-1, chunk, 0)
      # Wait for sound to finish
      while SDL2::Mixer::Channels.play?(channel)
        Fiber.yield
      end
    rescue => e
      warn "[Smalruby3] play_until_done error: #{e.message}"
    end

    def stop_all_sounds
      SDL2::Mixer::Channels.halt(-1)
    rescue => e
      warn "[Smalruby3] stop_all_sounds error: #{e.message}"
    end

    def change_sound_effect_by(_effect, _amount)
      # Stub — PITCH/PAN effects not yet implemented
    end

    def set_sound_effect(_effect, _value)
      # Stub
    end

    def clear_sound_effects
      # Stub
    end

    # --- Data ---

    def list(name)
      var = instance_variable_get(name.to_s.start_with?("@") ? name.to_sym : :"@#{name}")
      var.is_a?(List) ? var : List.new
    end

    def show_variable(name)
      @monitors[name] = :visible
    end

    def hide_variable(name)
      @monitors[name] = :hidden
    end

    def show_list(name)
      @monitors["list:#{name}"] = :visible
    end

    def hide_list(name)
      @monitors["list:#{name}"] = :hidden
    end

    # --- Sensing ---

    def ask(question)
      say(question)
      # Simplified: just set answer to empty string
      # Full implementation would need SDL2 text input
      @runtime.answer = ""
      @say_text = nil
    end

    def loudness
      0 # Not implemented
    end

    def user_name
      ""
    end

    def days_since_2000
      (Time.now - Time.new(2000, 1, 1)) / 86400.0
    end

    # Read a user-defined variable from this target by name.
    # Used by sprite("Sprite2").variable("@score") and stage.variable("$var").
    # Only exposes user variables (prefixed with @), not internal state.
    INTERNAL_IVARS = %i[
      @runtime @name @visible @say_text @think_text @effects @volume
      @sounds @monitors @x @y @direction @size @rotation_style
      @current_costume @costumes @is_clone @drag_mode @pen @music
      @backdrops @current_backdrop
    ].to_set.freeze

    def variable(name)
      ivar_name = name.to_s
      ivar_name = "@#{ivar_name}" unless ivar_name.start_with?("@")
      sym = ivar_name.to_sym
      return nil if INTERNAL_IVARS.include?(sym)
      instance_variable_get(sym)
    rescue NameError
      nil
    end

    private

    def find_sound(name)
      @sounds&.find { |s| s.name == name }
    end
  end
end
