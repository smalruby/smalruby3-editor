# frozen_string_literal: true

require "sdl2"

module Smalruby3
  module Render
    # Applies visual effects to a costume Surface and caches the result.
    # Only regenerates when effects change.
    module EffectSurface
      module_function

      # Returns an effect-applied Surface, or the original if no effects.
      # Caches results in the sprite's instance variable @_effect_cache.
      def apply(sprite)
        costume = sprite.current_costume_obj
        return nil unless costume

        effects = sprite.effects
        return costume.surface unless needs_effects?(effects)

        cache = sprite.instance_variable_get(:@_effect_cache) || {}
        cache_key = effects.hash ^ costume.path.hash

        if cache[:key] == cache_key && cache[:surface]
          return cache[:surface]
        end

        cache[:surface]&.destroy
        new_surface = transform(costume.surface, effects)
        cache[:key] = cache_key
        cache[:surface] = new_surface
        sprite.instance_variable_set(:@_effect_cache, cache)

        new_surface
      end

      def needs_effects?(effects)
        return false unless effects

        effects.any? do |name, value|
          next false if name == "ghost" # ghost is handled by alpha_mod
          value != 0
        end
      end

      def transform(source, effects)
        return source unless source

        w = source.w
        h = source.h
        src_pixels = source.pixels
        src_pitch = source.pitch
        bpp = src_pitch / w

        has_shape = EffectTransform.has_shape_effects?(effects)
        has_color = EffectTransform.has_color_effects?(effects)

        dst_data = "\x00".b * (w * h * 4)

        h.times do |py|
          w.times do |px|
            tex_x = (px + 0.5) / w
            tex_y = (py + 0.5) / h

            # Apply shape effects (coordinate remapping)
            if has_shape
              tex_x, tex_y = EffectTransform.transform_point(
                effects, tex_x, tex_y, w, h
              )
            end

            # Sample source pixel
            src_px = (tex_x * w).to_i.clamp(0, w - 1)
            src_py = (tex_y * h).to_i.clamp(0, h - 1)
            src_off = src_py * src_pitch + src_px * bpp

            r = src_pixels.getbyte(src_off)
            g = src_pixels.getbyte(src_off + 1)
            b = src_pixels.getbyte(src_off + 2)
            a = src_pixels.getbyte(src_off + 3)

            # Apply color effects
            if has_color && a > 0
              r, g, b, a = EffectTransform.transform_color(
                effects, r, g, b, a
              )
            end

            dst_off = (py * w + px) * 4
            dst_data.setbyte(dst_off, r)
            dst_data.setbyte(dst_off + 1, g)
            dst_data.setbyte(dst_off + 2, b)
            dst_data.setbyte(dst_off + 3, a)
          end
        end

        SDL2::Surface.from_string(dst_data, w, h, 32)
      end
    end
  end
end
