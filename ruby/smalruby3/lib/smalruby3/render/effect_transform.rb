# frozen_string_literal: true

module Smalruby3
  module Render
    # Ported from scratch-render's EffectTransform.
    # Applies graphic effects to texture coordinates and colors.
    module EffectTransform
      EFFECT_CONVERTERS = {
        "color" => ->(x) { (x / 200.0) % 1.0 },
        "fisheye" => ->(x) { [0, (x + 100) / 100.0].max },
        "whirl" => ->(x) { -x * Math::PI / 180.0 },
        "pixelate" => ->(x) { x.abs / 10.0 },
        "mosaic" => ->(x) { [[((x.abs + 10) / 10.0).round, 1].max, 512].min },
        "brightness" => ->(x) { x.clamp(-100, 100) / 100.0 },
        "ghost" => ->(x) { 1.0 - x.clamp(0, 100) / 100.0 }
      }.freeze

      SHAPE_EFFECTS = %w[fisheye whirl pixelate mosaic].freeze
      COLOR_EFFECTS = %w[color brightness ghost].freeze

      module_function

      # Convert Scratch effect values to uniform values
      def convert_effect(name, value)
        converter = EFFECT_CONVERTERS[name]
        converter ? converter.call(value) : value
      end

      # Apply shape-changing effects to texture coordinates.
      # Order: mosaic → pixelate → whirl → fisheye
      # Input/output: [tex_x, tex_y] in [0, 1]
      def transform_point(effects, tex_x, tex_y, skin_w, skin_h)
        x = tex_x
        y = tex_y

        # Mosaic
        if effects["mosaic"] && effects["mosaic"] != 0
          mosaic = convert_effect("mosaic", effects["mosaic"])
          x = (mosaic * x) % 1.0
          y = (mosaic * y) % 1.0
        end

        # Pixelate
        if effects["pixelate"] && effects["pixelate"] != 0
          pixelate = convert_effect("pixelate", effects["pixelate"])
          if pixelate > 0
            texel_x = skin_w / pixelate
            texel_y = skin_h / pixelate
            x = ((x * texel_x).floor + 0.5) / texel_x
            y = ((y * texel_y).floor + 0.5) / texel_y
          end
        end

        # Whirl
        if effects["whirl"] && effects["whirl"] != 0
          whirl_val = convert_effect("whirl", effects["whirl"])
          radius = 0.5
          offset_x = x - 0.5
          offset_y = y - 0.5
          offset_mag = Math.sqrt(offset_x * offset_x + offset_y * offset_y)
          whirl_factor = [1.0 - (offset_mag / radius), 0.0].max
          whirl_angle = whirl_val * whirl_factor * whirl_factor

          cos_w = Math.cos(whirl_angle)
          sin_w = Math.sin(whirl_angle)
          x = (cos_w * offset_x - sin_w * offset_y) + 0.5
          y = (sin_w * offset_x + cos_w * offset_y) + 0.5
        end

        # Fisheye
        if effects["fisheye"] && effects["fisheye"] != 0
          fisheye = convert_effect("fisheye", effects["fisheye"])
          if fisheye != 1.0
            vx = (x - 0.5) / 0.5
            vy = (y - 0.5) / 0.5
            v_len = Math.sqrt(vx * vx + vy * vy)

            if v_len > 0
              r = (v_len**fisheye) * [1.0, v_len].max
              unit_x = vx / v_len
              unit_y = vy / v_len
              x = 0.5 + (r * unit_x * 0.5)
              y = 0.5 + (r * unit_y * 0.5)
            end
          end
        end

        [x, y]
      end

      # Apply color-changing effects to an RGBA pixel.
      # Order: color → brightness → ghost
      # Input: [r, g, b, a] (0-255). Returns modified [r, g, b, a].
      def transform_color(effects, r, g, b, a)
        return [r, g, b, a] if a == 0

        has_color = effects["color"] && effects["color"] != 0
        has_brightness = effects["brightness"] && effects["brightness"] != 0
        has_ghost = effects["ghost"] && effects["ghost"] != 0

        if has_color || has_brightness
          # Un-premultiply alpha
          alpha = a / 255.0
          ur = alpha > 0 ? (r / alpha).clamp(0, 255) : 0
          ug = alpha > 0 ? (g / alpha).clamp(0, 255) : 0
          ub = alpha > 0 ? (b / alpha).clamp(0, 255) : 0

          if has_color
            color_val = convert_effect("color", effects["color"])
            h, s, v = ColorUtil.rgb_to_hsv(ur.round, ug.round, ub.round)

            # Ensure dark/low-saturation pixels show hue changes
            min_v = 0.11 / 2.0
            min_s = 0.09
            if v < min_v
              h = 0.0
              s = 1.0
              v = min_v
            elsif s < min_s
              h = 0.0
              s = min_s
            end

            h = (color_val + h + 1) % 1.0
            ur, ug, ub = ColorUtil.hsv_to_rgb(h, s, v)
          end

          if has_brightness
            brightness = convert_effect("brightness", effects["brightness"]) * 255
            ur = (ur + brightness).clamp(0, 255)
            ug = (ug + brightness).clamp(0, 255)
            ub = (ub + brightness).clamp(0, 255)
          end

          # Re-premultiply alpha
          r = (ur * alpha).round.clamp(0, 255)
          g = (ug * alpha).round.clamp(0, 255)
          b = (ub * alpha).round.clamp(0, 255)
        end

        if has_ghost
          ghost_val = convert_effect("ghost", effects["ghost"])
          r = (r * ghost_val).round
          g = (g * ghost_val).round
          b = (b * ghost_val).round
          a = (a * ghost_val).round
        end

        [r, g, b, a]
      end

      # Check if effects include any shape-changing effects
      def has_shape_effects?(effects)
        SHAPE_EFFECTS.any? { |e| effects[e] && effects[e] != 0 }
      end

      # Check if effects include any color-changing effects
      def has_color_effects?(effects)
        COLOR_EFFECTS.any? { |e| effects[e] && effects[e] != 0 }
      end
    end
  end
end
