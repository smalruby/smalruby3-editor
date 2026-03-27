# テスト: Music 拡張
require "smalruby3"

class Cat < Smalruby3::Sprite
  set_sprite "Cat 2"
  set_size 50

  when_flag_clicked do
    say("Music テスト開始！")
    music.tempo = 120

    # ドラムパターン
    3.times do
      music.play_drum(drum: 1, beats: 0.5)  # Snare
      music.play_drum(drum: 2, beats: 0.5)  # Bass
    end

    # メロディ（ドレミファソ）
    say("メロディ: ドレミファソ")
    music.instrument = 1  # Piano
    [60, 62, 64, 65, 67].each do |note|
      music.play_note(note: note, beats: 0.5)
    end

    say("完了！")
  end
end
