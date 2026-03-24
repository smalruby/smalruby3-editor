# frozen_string_literal: true

module Smalruby3
  module Render
    class BitmapSkin
      attr_reader :width, :height, :surface

      def initialize(surface)
        @surface = surface
        @width = surface.w
        @height = surface.h
      end
    end
  end
end
