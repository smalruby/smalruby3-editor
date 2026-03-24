# スモウルビー サンプル05: 変数とリスト
# スコアを数えるゲーム。星を集める。

require "smalruby3"

class Player < Smalruby3::Sprite
  set_sprite "Shimaraby"
  set_x 0
  set_y 0
  set_size 200

  when_flag_clicked do
    @score = 0
    timer.reset
    say("星を集めよう！ スコア: 0")
    loop do
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
      if touching?("Star")
        @score += 1
        say("スコア: #{@score}")
        broadcast("collected")
      end
      if timer.value > 30
        say("タイムアップ！ スコア: #{@score}")
        stop("all")
      end
    end
  end
end

class Star < Smalruby3::Sprite
  set_sprite "Star"
  set_size 200

  when_flag_clicked do
    go_to("_random_")
  end

  when_receive("collected") do
    go_to("_random_")
  end
end
