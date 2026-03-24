# frozen_string_literal: true

require "test_helper"

class MusicTest < Minitest::Test
  def setup
    @runtime = Smalruby3::Runtime.instance
    klass = Class.new(Smalruby3::Sprite)
    @sprite = klass.new(@runtime)
  end

  def test_default_tempo
    music = @sprite.music
    assert_equal 60, music.tempo
  end

  def test_set_tempo
    music = @sprite.music
    music.tempo = 120
    assert_equal 120, music.tempo
  end

  def test_tempo_minimum
    music = @sprite.music
    music.tempo = 5
    assert_equal 20, music.tempo # Clamped to min 20
  end

  def test_instrument
    music = @sprite.music
    assert_equal 1, music.instrument
    music.instrument = 5
    assert_equal 5, music.instrument
  end

  def test_instrument_clamp
    music = @sprite.music
    music.instrument = 100
    assert_equal 21, music.instrument # Max 21
  end

  def test_note_to_freq_a4
    freq = Smalruby3::Extension::Music.note_to_freq(69)
    assert_in_delta 440.0, freq, 0.01
  end

  def test_note_to_freq_c4
    freq = Smalruby3::Extension::Music.note_to_freq(60)
    assert_in_delta 261.63, freq, 0.1
  end

  def test_note_to_freq_octave
    freq_a3 = Smalruby3::Extension::Music.note_to_freq(57)
    freq_a4 = Smalruby3::Extension::Music.note_to_freq(69)
    assert_in_delta(2.0, freq_a4 / freq_a3, 0.01) # Octave = 2x frequency
  end
end
