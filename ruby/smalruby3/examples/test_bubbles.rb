# テスト: 複数スプライトの吹き出し表示
require "smalruby3"

class Cat1 < Smalruby3::Sprite
  set_sprite "Cat 2"
  set_x(-100)
  set_y 50

  when_flag_clicked do
    say("こんにちは！")
  end
end

class Cat2 < Smalruby3::Sprite
  set_sprite "Cat 2"
  set_x 100
  set_y 50

  when_flag_clicked do
    think("これは think です")
  end
end

class Cat3 < Smalruby3::Sprite
  set_sprite "Cat 2"
  set_x 0
  set_y(-80)

  when_flag_clicked do
    say("長いテキストのテスト: Scratch の吹き出しは170px幅で自動折り返しされます。正しく表示されていますか？")
  end
end
