# スモウルビー サンプル03: クローン
# スペースキーでクローンを生成。クローンはマウスに向かって飛ぶ。

require "smalruby3"

class Shooter < Smalruby3::Sprite
  set_sprite "Shimaraby"
  set_x 0
  set_y -120
  set_size 200

  when_flag_clicked do
    say("スペースキーで発射！")
    loop do
      if keyboard.pressed?("left arrow")
        self.x -= 5
      end
      if keyboard.pressed?("right arrow")
        self.x += 5
      end
    end
  end

  when_key_pressed("space") do
    create_clone("_myself_")
  end

  when_start_as_a_clone do
    self.y = -100
    self.size = 100
    point_towards("_mouse_")
    20.times.with_screen_refresh do
      move(8)
    end
    delete_this_clone
  end
end
