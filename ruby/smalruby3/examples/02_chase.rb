# スモウルビー サンプル02: 追いかけっこ
# ネコがマウスを追いかける。ボールはランダムに動く。

require "smalruby3"

class Cat < Smalruby3::Sprite
  set_sprite "Shimaraby"
  set_x(-100)
  set_y 0
  set_size 200

  when_flag_clicked do
    loop.with_screen_refresh do
      point_towards("_mouse_")
      move(3)
      if touching?("Ball")
        say("つかまえた！", 1)
        broadcast("reset")
      end
    end
  end
end

class Ball < Smalruby3::Sprite
  set_sprite "Ball"
  set_x 100
  set_y 50
  set_size 200

  when_flag_clicked do
    loop.with_screen_refresh do
      move(2)
      turn_right(rand(-30..30))
      bounce_if_on_edge
    end
  end

  when_receive("reset") do
    go_to("_random_")
  end
end
