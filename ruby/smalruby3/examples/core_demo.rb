require "smalruby3"

class Player < Smalruby3::Sprite
  set_sprite "Shimaraby"
  set_x -100
  set_y 0

  when_flag_clicked do
    say("Arrow keys to move, space to clone!")
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
      if keyboard.pressed?("space")
        create_clone("_myself_")
      end
      bounce_if_on_edge
    end
  end

  when_start_as_a_clone do
    say("I'm a clone!")
    point_towards("_mouse_")
    10.times { |_i| move(5); Fiber.yield }
    delete_this_clone
  end
end
