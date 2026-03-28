# frozen_string_literal: true

require "sdl2"

module Smalruby3
  module Render
    # Renders variable and list monitors matching Scratch's monitor style.
    class MonitorRenderer
      FONT_SIZE = 11
      FONT_SIZE_BOLD = 12
      PADDING = 5
      ROW_HEIGHT = 22
      BORDER_RADIUS = 4

      # Colors matching Scratch
      OUTER_BORDER = [192, 192, 192, 255].freeze  # light gray border
      OUTER_BG = [255, 255, 255, 255].freeze       # white background
      LABEL_COLOR = [87, 94, 117].freeze            # #575E75 dark gray
      VALUE_BG = [240, 164, 60, 255].freeze         # orange
      VALUE_TEXT = [255, 255, 255].freeze            # white
      LIST_HEADER_BG = [255, 255, 255, 255].freeze
      LIST_ROW_BG = [218, 227, 243, 255].freeze     # light blue
      LIST_IDX_COLOR = [87, 94, 117].freeze          # dark gray
      LIST_ITEM_BG = [240, 164, 60, 255].freeze      # orange
      LIST_ITEM_TEXT = [255, 255, 255].freeze
      LIST_FOOTER_BG = [255, 255, 255, 255].freeze

      def initialize(sdl_renderer)
        @sdl_renderer = sdl_renderer
        @font = nil
        @font_bold = nil
      end

      def draw(targets)
        ensure_font
        return unless @font

        y_off = 5
        targets.each do |target|
          next unless target.respond_to?(:monitors)

          target.monitors.each do |key, state|
            next unless state == :visible

            if key.start_with?("list:")
              name = key.delete_prefix("list:")
              list_val = target.instance_variable_get(name.to_s.start_with?("@") ? name.to_sym : :"@#{name}")
              y_off = draw_list(target, name, list_val, y_off)
            else
              value = target.variable(key)
              y_off = draw_var(target, key, value, y_off)
            end
          end
        end
      end

      def destroy
        @font&.destroy
        @font_bold&.destroy
        @font = nil
        @font_bold = nil
      end

      private

      def ensure_font
        return if @font

        SDL2::TTF.init
        path = find_font
        return unless path

        @font = SDL2::TTF.open(path, FONT_SIZE)
        @font_bold = SDL2::TTF.open(path, FONT_SIZE_BOLD)
        @font_bold.style = SDL2::TTF::Style::BOLD
      end

      def find_font
        [
          "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
          "/System/Library/Fonts/Supplemental/Hiragino Sans W3.otf",
          "/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf",
          "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
          "/System/Library/Fonts/Helvetica.ttc"
        ].find { |p| File.exist?(p) }
      end

      # --- Variable monitor ---

      def draw_var(target, name, value, y_off)
        label = format_label(target, name)
        val_str = format_value(value)

        label_w, = @font_bold.size_text(label)
        val_w, = @font.size_text(val_str)
        val_box_w = [val_w + PADDING * 4, 30].max

        total_w = label_w + val_box_w + PADDING * 4
        total_h = ROW_HEIGHT + PADDING * 2
        x = 5

        # Outer rounded box (border + white fill)
        draw_rounded_box(x, y_off, total_w, total_h)

        # Label (bold, dark gray)
        draw_text_with(@font_bold, label, x + PADDING + 2,
          y_off + (total_h - @font_bold.height) / 2, LABEL_COLOR)

        # Value (orange rounded pill)
        vx = x + PADDING + 2 + label_w + PADDING * 2
        vy = y_off + PADDING
        vh = total_h - PADDING * 2
        draw_pill(vx, vy, val_box_w, vh, VALUE_BG)
        draw_text_with(@font, val_str,
          vx + (val_box_w - val_w) / 2,
          vy + (vh - @font.height) / 2, VALUE_TEXT)

        y_off + total_h + 3
      end

      # --- List monitor ---

      def draw_list(target, name, list, y_off)
        label = format_label(target, name)
        items = list.is_a?(Array) ? list : list.to_a

        list_w = 140
        header_h = ROW_HEIGHT + 2
        item_h = ROW_HEIGHT
        max_visible = [items.size, 8].min
        body_h = item_h * [max_visible, 1].max
        footer_h = ROW_HEIGHT
        total_h = header_h + body_h + footer_h
        x = 5

        # Outer rounded box
        draw_rounded_box(x, y_off, list_w, total_h)

        # Header: label (bold)
        draw_text_with(@font_bold, label, x + PADDING + 2,
          y_off + (header_h - @font_bold.height) / 2, LABEL_COLOR)
        cur_y = y_off + header_h

        # List rows
        max_visible.times do |i|
          row_y = cur_y + i * item_h

          # Row background (light blue)
          set_color(LIST_ROW_BG)
          @sdl_renderer.fill_rect(SDL2::Rect.new(x + 2, row_y,
            list_w - 4, item_h - 1))

          # Index number
          idx_str = (i + 1).to_s
          idx_w, = @font.size_text(idx_str)
          draw_text_with(@font, idx_str, x + PADDING + 2,
            row_y + (item_h - @font.height) / 2, LIST_IDX_COLOR)

          # Value pill (orange)
          val_str = format_value(items[i])
          val_w, = @font.size_text(val_str)
          pill_x = x + PADDING + idx_w + PADDING + 4
          pill_w = [val_w + PADDING * 3, list_w - pill_x + x - PADDING].min
          pill_y = row_y + 2
          pill_h = item_h - 5
          draw_pill(pill_x, pill_y, pill_w, pill_h, LIST_ITEM_BG)
          draw_text_with(@font, val_str,
            pill_x + (pill_w - val_w) / 2,
            pill_y + (pill_h - @font.height) / 2, LIST_ITEM_TEXT)
        end

        # Footer
        footer_y = cur_y + max_visible * item_h
        footer_text = "長さ #{items.size}"
        draw_text_with(@font, footer_text,
          x + (list_w - @font.size_text(footer_text)[0]) / 2,
          footer_y + (footer_h - @font.height) / 2, LABEL_COLOR)

        y_off + total_h + 3
      end

      # --- Drawing helpers ---

      def draw_rounded_box(x, y, w, h)
        # Border
        set_color(OUTER_BORDER)
        @sdl_renderer.fill_rect(SDL2::Rect.new(x, y, w, h))
        # White fill (inset by 1px for border)
        set_color(OUTER_BG)
        @sdl_renderer.fill_rect(SDL2::Rect.new(x + 1, y + 1, w - 2, h - 2))
      end

      def draw_pill(x, y, w, h, color)
        r = h / 2
        set_color(color)
        @sdl_renderer.fill_rect(SDL2::Rect.new(x + r, y, w - 2 * r, h))
        fill_circle(x + r, y + r, r)
        fill_circle(x + w - r - 1, y + r, r)
      end

      def fill_circle(cx, cy, r)
        r2 = r * r
        (-r..r).each do |dy|
          dx = Math.sqrt([r2 - dy * dy, 0].max).to_i
          @sdl_renderer.draw_line(cx - dx, cy + dy, cx + dx, cy + dy)
        end
      end

      def set_color(rgba)
        @sdl_renderer.draw_blend_mode = SDL2::BlendMode::BLEND
        @sdl_renderer.draw_color = rgba
      end

      def draw_text_with(font, text, x, y, color)
        return if text.nil? || text.empty?

        surface = font.render_blended(text, color)
        return unless surface

        texture = @sdl_renderer.create_texture_from(surface)
        texture.blend_mode = SDL2::BlendMode::BLEND
        dst = SDL2::Rect.new(x, y, surface.w, surface.h)
        @sdl_renderer.copy(texture, nil, dst)
        texture.destroy
        surface.destroy
      end

      def format_label(target, name)
        prefix = target.is_a?(Stage) ? "" : "#{target.name}: "
        display_name = name.delete_prefix("@")
        "#{prefix}#{display_name}"
      end

      def format_value(value)
        case value
        when Float
          (value == value.to_i) ? value.to_i.to_s : value.round(2).to_s
        when nil
          "0"
        else
          value.to_s
        end
      end
    end
  end
end
