# frozen_string_literal: true

module Smalruby3
  module Render
    class TextBubble
      # Character-by-character text wrapping with CJK support.
      # Requires `@font` to be set before use.
      module TextWrapper
        private

        def wrap_text(text)
          return [""] if text.empty?

          lines = []
          text.split("\n").each do |para|
            if para.empty?
              lines << ""
            else
              wrap_paragraph(para, lines)
            end
          end
          lines.empty? ? [""] : lines
        end

        def wrap_paragraph(para, lines)
          current = ""
          buf = "" # word buffer for non-CJK

          para.each_char do |ch|
            if ch == " "
              # Flush buffer + space
              buf += ch
            elsif cjk?(ch)
              # Flush any buffered word first
              current = flush_word(buf, current, lines) unless buf.empty?
              buf = ""
              # Try adding CJK char
              test = current + ch
              w, = @font.size_text(test)
              if w <= MAX_LINE_WIDTH
                current = test
              else
                lines << current unless current.empty?
                current = ch
              end
            else
              buf += ch
            end
          end

          # Flush remaining buffer
          current = flush_word(buf, current, lines) unless buf.empty?
          lines << current unless current.empty?
        end

        def flush_word(word, current, lines)
          test = current + word
          w, = @font.size_text(test)
          if w <= MAX_LINE_WIDTH
            test
          else
            lines << current unless current.empty?
            word.lstrip
          end
        end

        def cjk?(ch)
          cp = ch.ord
          cp.between?(0x3000, 0x9FFF) ||
            cp.between?(0xF900, 0xFAFF) ||
            cp.between?(0xFF00, 0xFFEF)
        end
      end
    end
  end
end
