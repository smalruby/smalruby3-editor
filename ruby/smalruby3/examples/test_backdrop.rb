# テスト: 背景画像の表示
require "smalruby3"

class Stage < Smalruby3::Stage
  set_backdrops ["Blue Sky"]

  when_flag_clicked do
    say("背景が表示されていれば成功！")
  end
end

class Cat < Smalruby3::Sprite
  set_sprite "Cat 2"
  set_x 0
  set_y 0

  when_flag_clicked do
    loop.with_screen_refresh do
      move(2)
      bounce_if_on_edge
    end
  end
end
