# frozen_string_literal: true

require "singleton"

module Smalruby3
  class Runtime
    include Singleton

    STAGE_WIDTH = 480
    STAGE_HEIGHT = 360
    FPS = 30
    FRAME_TIME = 1.0 / FPS

    attr_reader :keyboard, :mouse, :clock, :renderer, :sequencer
    attr_reader :stage, :sprites

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
    end

    def register_sprite(klass)
      @sprite_classes << klass
    end

    def register_stage(klass)
      @stage_class = klass
    end

    def find_target(name)
      return @stage if name == "_stage_"
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
          when :key_up
            @keyboard.handle_key_up(args[0])
          when :mouse_motion
            @mouse.handle_motion(args[0], args[1])
          when :mouse_button_down
            @mouse.handle_button_down
          when :mouse_button_up
            @mouse.handle_button_up
          end
        end
      end
    end

    def render
      @renderer.begin_frame
      @renderer.draw_stage(@stage) if @stage
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
