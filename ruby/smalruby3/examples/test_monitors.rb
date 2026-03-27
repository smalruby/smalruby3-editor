# テスト: 変数/リストモニター表示
require "smalruby3"

class Cat < Smalruby3::Sprite
  set_sprite "Cat 2"
  set_size 50

  def initialize(runtime)
    super
    @score = 0
    @player = ""
    @items = []
  end

  when_flag_clicked do
    @score = 42
    @player = "Smalruby"
    @items = ["りんご", "バナナ", "みかん"]
    show_variable("@score")
    show_variable("@player")
    show_list("@items")
    say("モニター表示テスト")
  end
end
