# テスト: 視覚エフェクト描画
require "smalruby3"

class Cat1 < Smalruby3::Sprite
  set_sprite "Cat 2"
  set_x(-150)
  set_y 50
  set_size 50

  when_flag_clicked do
    set_effect("color", 50)
    say("color=50")
  end
end

class Cat2 < Smalruby3::Sprite
  set_sprite "Cat 2"
  set_x 0
  set_y 50
  set_size 50

  when_flag_clicked do
    set_effect("brightness", 30)
    say("brightness=30")
  end
end

class Cat3 < Smalruby3::Sprite
  set_sprite "Cat 2"
  set_x 150
  set_y 50
  set_size 50

  when_flag_clicked do
    set_effect("ghost", 50)
    say("ghost=50")
  end
end

class Cat4 < Smalruby3::Sprite
  set_sprite "Cat 2"
  set_x(-100)
  set_y(-80)
  set_size 50

  when_flag_clicked do
    set_effect("fisheye", 100)
    say("fisheye=100")
  end
end

class Cat5 < Smalruby3::Sprite
  set_sprite "Cat 2"
  set_x 100
  set_y(-80)
  set_size 50

  when_flag_clicked do
    set_effect("whirl", 90)
    say("whirl=90")
  end
end
