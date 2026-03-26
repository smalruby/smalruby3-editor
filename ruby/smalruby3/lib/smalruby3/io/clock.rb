# frozen_string_literal: true

module Smalruby3
  module IO
    class Clock
      def initialize
        @start_time = Time.now
      end

      def value
        (Time.now - @start_time).to_f
      end

      def reset
        @start_time = Time.now
      end
    end
  end
end
