# スモウルビー サンプル06: ステージ
# class Stage を明示的に定義して、背景の切り替えやイベント送受信を行う。
# class Stage を省略した場合は、白い背景のデフォルトステージが自動生成される。

require "smalruby3"

class Stage < Smalruby3::Stage
  set_backdrops ["backdrop1", "backdrop2"]
  set_sounds ["pop"]

  when_flag_clicked do
    broadcast("start")
  end

  when_receive("change_backdrop") do
    next_backdrop
    say("背景を変えました！", 1)
  end
end

class Player < Smalruby3::Sprite
  set_sprite "Shimaraby"
  set_x 0
  set_y 0
  set_size 200

  when_flag_clicked do
    say("スペースキーで背景を変更！")
    loop.with_screen_refresh do
      if keyboard.pressed?("right arrow")
        self.x += 5
      end
      if keyboard.pressed?("left arrow")
        self.x -= 5
      end
    end
  end

  when_key_pressed("space") do
    broadcast("change_backdrop")
  end
end
