# frozen_string_literal: true

require "test_helper"
require "fileutils"
require "tempfile"

class SecurityTest < Minitest::Test
  def setup
    @am = Smalruby3::AssetManager.new
  end

  # --- md5ext validation ---

  def test_rejects_path_traversal_in_md5ext
    assert_nil @am.send(:resolve_asset, "../../.bashrc")
  end

  def test_rejects_md5ext_with_slashes
    assert_nil @am.send(:resolve_asset, "subdir/abc123.png")
  end

  def test_rejects_md5ext_with_dotdot
    assert_nil @am.send(:resolve_asset, "../etc/passwd")
  end

  def test_rejects_empty_md5ext
    assert_nil @am.send(:resolve_asset, "")
  end

  def test_rejects_nil_md5ext
    assert_nil @am.send(:resolve_asset, nil)
  end

  def test_accepts_valid_md5ext
    assert @am.send(:valid_md5ext?, "ddaccfcda466a4887299feddc899fea7.png")
    assert @am.send(:valid_md5ext?, "abc123.wav")
    assert @am.send(:valid_md5ext?, "abc123.svg")
  end

  def test_rejects_invalid_md5ext_formats
    refute @am.send(:valid_md5ext?, "file with spaces.png")
    refute @am.send(:valid_md5ext?, "UPPERCASE.PNG")
    refute @am.send(:valid_md5ext?, "../traversal.png")
    refute @am.send(:valid_md5ext?, "no_extension")
    refute @am.send(:valid_md5ext?, ".hidden")
    refute @am.send(:valid_md5ext?, "abc.exe")
  end

  # --- Symlink protection in cache ---

  def test_cache_rejects_symlinks
    cache_dir = File.join(Smalruby3.home, "cache", "assets")
    FileUtils.mkdir_p(cache_dir)
    symlink_path = File.join(cache_dir, "test_symlink.png")

    begin
      # Create a temp target file and symlink
      target = Tempfile.new("target")
      target.write("fake content")
      target.close

      File.symlink(target.path, symlink_path) unless File.exist?(symlink_path)

      # regular_file? should reject symlinks
      refute @am.send(:regular_file?, symlink_path)
    ensure
      File.delete(symlink_path) if File.symlink?(symlink_path)
      target&.close!
    end
  end

  # --- URL validation ---

  def test_rejects_absolute_raw_url
    url = @am.send(:build_download_url, "abc123.png", "http://evil.com/payload.png")
    assert_nil url
  end

  def test_rejects_ftp_raw_url
    url = @am.send(:build_download_url, "abc123.png", "ftp://evil.com/file.png")
    assert_nil url
  end

  def test_accepts_relative_raw_url
    url = @am.send(:build_download_url, "abc123.png", "static/smalruby-assets/abc123.png")
    assert_equal "https://smalruby.app/static/smalruby-assets/abc123.png", url
  end

  def test_scratch_url_uses_https
    url = @am.send(:build_download_url, "abc123.png", nil)
    assert url.start_with?("https://")
  end

  # --- Path traversal in safe_cache_path ---

  def test_safe_cache_path_rejects_traversal
    assert_nil @am.send(:safe_cache_path, "../../etc/passwd")
  end

  def test_safe_cache_path_accepts_valid
    path = @am.send(:safe_cache_path, "abc123.png")
    assert path
    assert path.end_with?("abc123.png")
  end

  # --- Costume sprite_name validation ---

  def test_costume_load_rejects_traversal_in_sprite_name
    costumes = Smalruby3::Costume.load_for_sprite("../../etc")
    assert_empty costumes
  end

  def test_costume_load_rejects_slashes
    costumes = Smalruby3::Costume.load_for_sprite("subdir/name")
    assert_empty costumes
  end

  def test_costume_load_accepts_valid_names
    # Valid names with spaces, hyphens, underscores
    assert Smalruby3::Costume.load_for_sprite("Cat 2").is_a?(Array)
    assert Smalruby3::Costume.load_for_sprite("Shimaraby").is_a?(Array)
  end

  # --- Target#variable internal state protection ---

  def test_variable_cannot_read_runtime
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(Smalruby3::Runtime.instance)
    assert_nil s.variable("@runtime")
  end

  def test_variable_cannot_read_sounds
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(Smalruby3::Runtime.instance)
    assert_nil s.variable("@sounds")
  end

  def test_variable_can_read_user_defined
    klass = Class.new(Smalruby3::Sprite)
    s = klass.new(Smalruby3::Runtime.instance)
    s.instance_variable_set(:@score, 42)
    assert_equal 42, s.variable("@score")
  end
end
