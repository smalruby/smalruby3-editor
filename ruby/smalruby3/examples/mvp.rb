require "smalruby3"

class Player < Smalruby3::Sprite
  set_sprite "Shimaraby"
  set_x -150

  when_flag_clicked do
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
    end
  end
end
