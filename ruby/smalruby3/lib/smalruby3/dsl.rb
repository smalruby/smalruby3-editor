# frozen_string_literal: true

module Smalruby3
  module DSL
    module SpriteClassMethods
      def _event_handlers
        @_event_handlers ||= {}
      end

      def _name
        @_name
      end

      def _sprite_name
        @_sprite_name
      end

      def _initial_x
        @_initial_x || 0
      end

      def _initial_y
        @_initial_y || 0
      end

      def _initial_direction
        @_initial_direction || 90
      end

      def _initial_visible
        instance_variable_defined?(:@_initial_visible) ? @_initial_visible : true
      end

      def _initial_size
        @_initial_size || 100
      end

      def _initial_rotation_style
        @_initial_rotation_style || "all around"
      end

      def _costume_names
        @_costume_names || []
      end

      def _sound_names
        @_sound_names || []
      end

      def _initial_costume
        @_initial_costume || 0
      end

      # Configuration methods (class-level)
      def set_name(name)
        @_name = name
      end

      def set_sprite(name)
        @_sprite_name = name
      end

      def set_x(value)
        @_initial_x = value
      end

      def set_y(value)
        @_initial_y = value
      end

      def set_direction(value)
        @_initial_direction = value
      end

      def set_visible(value)
        @_initial_visible = value
      end

      def set_size(value)
        @_initial_size = value
      end

      def set_rotation_style(style)
        @_initial_rotation_style = style
      end

      def set_costumes(list)
        @_costume_names = list
      end

      def set_sounds(list)
        @_sound_names = list
      end

      def set_current_costume(value)
        @_initial_costume = value
      end

      # Event handlers
      def when_flag_clicked(&block)
        (_event_handlers[:flag_clicked] ||= []) << block
      end

      def when_key_pressed(key, &block)
        (_event_handlers[:key_pressed] ||= []) << [key, block]
      end

      def when_clicked(&block)
        (_event_handlers[:clicked] ||= []) << block
      end

      def when_receive(message, &block)
        (_event_handlers[:broadcast_received] ||= []) << [message, block]
      end

      def when_start_as_a_clone(&block)
        (_event_handlers[:clone_start] ||= []) << block
      end

      def when_backdrop_switches(name, &block)
        (_event_handlers[:backdrop_switches] ||= []) << [name, block]
      end

      def when_greater_than(type, value, &block)
        (_event_handlers[:greater_than] ||= []) << [type, value, block]
      end
    end

    module StageClassMethods
      def _event_handlers
        @_event_handlers ||= {}
      end

      def _name
        @_name
      end

      def _initial_visible
        true
      end

      def _backdrop_names
        @_backdrop_names || []
      end

      def _sound_names
        @_sound_names || []
      end

      def _initial_backdrop
        @_initial_backdrop || 0
      end

      def set_name(name)
        @_name = name
      end

      def set_backdrops(list)
        @_backdrop_names = list
      end

      def set_sounds(list)
        @_sound_names = list
      end

      def set_current_backdrop(value)
        @_initial_backdrop = value
      end

      # Event handlers (same as Sprite)
      def when_flag_clicked(&block)
        (_event_handlers[:flag_clicked] ||= []) << block
      end

      def when_key_pressed(key, &block)
        (_event_handlers[:key_pressed] ||= []) << [key, block]
      end

      def when_receive(message, &block)
        (_event_handlers[:broadcast_received] ||= []) << [message, block]
      end

      def when_backdrop_switches(name, &block)
        (_event_handlers[:backdrop_switches] ||= []) << [name, block]
      end

      def when_greater_than(type, value, &block)
        (_event_handlers[:greater_than] ||= []) << [type, value, block]
      end
    end
  end
end
