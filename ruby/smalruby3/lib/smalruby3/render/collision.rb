# frozen_string_literal: true

module Smalruby3
  module Render
    class Collision
      # Check if two sprites overlap at pixel level
      def self.sprites_touching?(sprite_a, sprite_b)
        bounds_a = sprite_bounds(sprite_a)
        bounds_b = sprite_bounds(sprite_b)
        return false unless bounds_a && bounds_b

        # AABB intersection
        left = [bounds_a[:left], bounds_b[:left]].max
        right = [bounds_a[:right], bounds_b[:right]].min
        bottom = [bounds_a[:bottom], bounds_b[:bottom]].max
        top = [bounds_a[:top], bounds_b[:top]].min
        return false if left > right || bottom > top

        sil_a = sprite_a.current_costume_obj&.silhouette
        sil_b = sprite_b.current_costume_obj&.silhouette
        return false unless sil_a && sil_b

        # Check overlapping pixels
        y = bottom.ceil
        while y <= top.floor
          x = left.ceil
          while x <= right.floor
            tx_a, ty_a = world_to_texture(x, y, sprite_a)
            if tx_a && sil_a.opaque_at?(tx_a, ty_a)
              tx_b, ty_b = world_to_texture(x, y, sprite_b)
              return true if tx_b && sil_b.opaque_at?(tx_b, ty_b)
            end
            x += 1
          end
          y += 1
        end
        false
      end

      # Check if sprite's pixels touch a specific color on other drawables
      def self.sprite_touching_color?(sprite, target_rgb, all_sprites, stage)
        bounds = sprite_bounds(sprite)
        return false unless bounds

        sil = sprite.current_costume_obj&.silhouette
        return false unless sil

        # Collect other visible sprites (z-order, topmost first)
        others = all_sprites.select { |s| s != sprite && s.visible }

        y = bounds[:bottom].ceil
        while y <= bounds[:top].floor
          x = bounds[:left].ceil
          while x <= bounds[:right].floor
            tx, ty = world_to_texture(x, y, sprite)
            if tx && sil.opaque_at?(tx, ty)
              blended = sample_color_at(x, y, others)
              return true if ColorUtil.color_matches?(blended, target_rgb)
            end
            x += 1
          end
          y += 1
        end
        false
      end

      # Check if a specific color on sprite touches a specific color on other drawables
      def self.color_touching_color?(sprite, mask_rgb, target_rgb, all_sprites, stage)
        bounds = sprite_bounds(sprite)
        return false unless bounds

        sil = sprite.current_costume_obj&.silhouette
        return false unless sil

        others = all_sprites.select { |s| s != sprite && s.visible }

        y = bounds[:bottom].ceil
        while y <= bounds[:top].floor
          x = bounds[:left].ceil
          while x <= bounds[:right].floor
            tx, ty = world_to_texture(x, y, sprite)
            if tx
              color = sil.color_at(tx, ty)
              if ColorUtil.mask_matches?(color, mask_rgb)
                blended = sample_color_at(x, y, others)
                return true if ColorUtil.color_matches?(blended, target_rgb)
              end
            end
            x += 1
          end
          y += 1
        end
        false
      end

      # Check if a world point is inside a sprite's opaque region
      def self.point_touching_sprite?(wx, wy, sprite)
        sil = sprite.current_costume_obj&.silhouette
        return false unless sil
        tx, ty = world_to_texture(wx, wy, sprite)
        return false unless tx
        sil.opaque_at?(tx, ty)
      end

      # --- Helpers ---

      # Convert Scratch world coordinates to texture coordinates [0,1]
      def self.world_to_texture(wx, wy, sprite)
        costume = sprite.current_costume_obj
        return nil unless costume

        scale = sprite.size / 100.0
        return nil if scale <= 0

        rotation = (90 - sprite.direction) * Math::PI / 180.0
        cos_r = Math.cos(rotation)
        sin_r = Math.sin(rotation)

        cx = costume.rotation_center_x || costume.width / 2.0
        cy = costume.rotation_center_y || costume.height / 2.0

        # World → sprite-local (undo position)
        dx = wx - sprite.x
        dy = sprite.y - wy # Y flip (Scratch +Y up → image +Y down)

        # Undo rotation and scale
        local_x = (cos_r * dx + sin_r * dy) / scale + cx
        local_y = (-sin_r * dx + cos_r * dy) / scale + cy

        # To texture coordinates [0, 1]
        tx = local_x / costume.width.to_f
        ty = local_y / costume.height.to_f

        return nil if tx < 0 || tx > 1 || ty < 0 || ty > 1

        # Apply shape-changing effects (fisheye, whirl, pixelate, mosaic)
        effects = sprite.respond_to?(:effects) ? sprite.effects : {}
        if EffectTransform.has_shape_effects?(effects)
          tx, ty = EffectTransform.transform_point(effects, tx, ty, costume.width, costume.height)
          return nil if tx < 0 || tx > 1 || ty < 0 || ty > 1
        end

        [tx, ty]
      end

      # Get sprite's AABB in Scratch world coordinates
      def self.sprite_bounds(sprite)
        costume = sprite.current_costume_obj
        return nil unless costume

        scale = sprite.size / 100.0
        w = costume.width * scale / 2.0
        h = costume.height * scale / 2.0

        # Simplified: axis-aligned bounds (ignoring rotation for performance)
        # For rotated sprites, expand by max dimension
        if sprite.direction != 90 && sprite.direction != 0
          diag = Math.sqrt(w * w + h * h)
          w = diag
          h = diag
        end

        {
          left: sprite.x - w,
          right: sprite.x + w,
          bottom: sprite.y - h,
          top: sprite.y + h
        }
      end

      # Sample blended color at a world point from all given sprites
      def self.sample_color_at(wx, wy, sprites)
        colors = []
        sprites.reverse_each do |s| # Top-most first
          next unless s.visible
          sil = s.current_costume_obj&.silhouette
          next unless sil
          tx, ty = world_to_texture(wx, wy, s)
          next unless tx
          color = sil.color_at(tx, ty)
          # Apply color-changing effects
          effects = s.respond_to?(:effects) ? s.effects : {}
          if color[3] > 0 && EffectTransform.has_color_effects?(effects)
            color = EffectTransform.transform_color(effects, *color)
          end
          colors << color if color[3] > 0
        end
        ColorUtil.blend_colors(colors)
      end
    end
  end
end
