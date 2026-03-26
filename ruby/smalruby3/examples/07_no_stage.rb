# スモウルビー サンプル07: ステージなし（デフォルトステージ）
# class Stage を定義しない場合、白い背景のデフォルトステージが自動生成される。

require "smalruby3"

class Cat < Smalruby3::Sprite
  set_sprite "Shimaraby"
  set_x 0
  set_y 0
  set_size 100

  when_flag_clicked do
    say("白い背景で動くよ！")
    loop.with_screen_refresh do
      move(3)
      turn_right(3)
      bounce_if_on_edge
    end
  end
end
