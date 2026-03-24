# スモウルビー サンプル04: ペンで絵を描く
# 矢印キーで移動、スペースでペンの上げ下げ、Cでクリア

require "smalruby3"

class Painter < Smalruby3::Sprite
  set_sprite "Shimaraby"
  set_x 0
  set_y 0
  set_size 150

  when_flag_clicked do
    pen.size = 3
    pen.color = "#0000ff"
    say("Space=ペン切替 C=消去")
    loop do
      if keyboard.pressed?("right arrow")
        self.x += 3
      end
      if keyboard.pressed?("left arrow")
        self.x -= 3
      end
      if keyboard.pressed?("up arrow")
        self.y += 3
      end
      if keyboard.pressed?("down arrow")
        self.y -= 3
      end
    end
  end

  when_key_pressed("space") do
    if pen.down?
      pen.up
      say("ペンアップ", 0.5)
    else
      pen.down
      say("ペンダウン", 0.5)
    end
  end

  when_key_pressed("c") do
    pen.clear
    say("クリア！", 0.5)
  end
end
