# スモウルビー サンプル01: 基本操作
# 矢印キーでスプライトを動かす

require "smalruby3"

class Player < Smalruby3::Sprite
  set_sprite "Shimaraby"
  set_x 0
  set_y 0
  set_size 100

  when_flag_clicked do
    say("矢印キーで動かしてね！")
    loop.with_screen_refresh do
      if keyboard.pressed?("right arrow")
        self.x += 5
      end
      if keyboard.pressed?("left arrow")
        self.x -= 5
      end
      if keyboard.pressed?("up arrow")
        self.y += 5
      end
      if keyboard.pressed?("down arrow")
        self.y -= 5
      end
      bounce_if_on_edge
    end
  end
end
