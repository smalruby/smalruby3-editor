# MeshInput - クライアントから受け取る ID・グループ名・イベントの payload の入力上限 (issue #1267 / #1846)
#
# サーバーはクライアントを信じすぎないよう、長さと使える文字の上限だけを持つ。
# グループ名・payload の中身（`|host=` などの書式）はクライアント間の約束なので検査しない。
# 同じ上限を AppSync JS リゾルバ側（js/shared/meshInputValidation.js）にも持つ。対で更新すること。
module MeshInput
  # ArgumentError の一種にして、既存の `raise_error(ArgumentError)` 期待や rescue と互換にする
  class ValidationError < ArgumentError; end

  # 今のクライアントの ID は 32 桁の 16 進（+ 任意で `s<2〜3 桁>`）。
  # 余裕を持たせ、旧形式・テストのハイフン入り ID も通す。`#` / `|` などキー区切りに使う文字は通さない。
  ID_MAX_LENGTH = 128
  ID_PATTERN = /\A[A-Za-z0-9_-]+\z/

  # クライアントは 512 文字以内で作る。余裕を持って 2 倍。
  GROUP_NAME_MAX_LENGTH = 1024
  CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/

  # イベントの payload の上限（GUI の上限と同じ 1000 文字。issue #1846）。
  # 費用と悪用を防ぐため、GUI だけでなくサーバーでも守る。payload が無い（nil）イベントは検査しない。
  # 文字数は UTF-16 のコード単位（絵文字は 2）で数える。GUI と AppSync JS リゾルバの String#length に
  # そろえるため（Ruby の String#length はコードポイント単位なので使わない）。
  PAYLOAD_MAX_LENGTH = 1000

  module_function

  def validate_id!(value, field)
    raise ValidationError, "#{field} is required" if value.nil? || value.to_s.empty?
    value = value.to_s
    raise ValidationError, "#{field} must be #{ID_MAX_LENGTH} characters or less" if value.length > ID_MAX_LENGTH
    raise ValidationError, "#{field} contains invalid characters (allowed: A-Z a-z 0-9 _ -)" unless ID_PATTERN.match?(value)
  end

  def validate_group_name!(value, field = "name")
    raise ValidationError, "#{field} is required" if value.nil? || value.to_s.empty?
    value = value.to_s
    raise ValidationError, "#{field} must be #{GROUP_NAME_MAX_LENGTH} characters or less" if value.length > GROUP_NAME_MAX_LENGTH
    raise ValidationError, "#{field} contains control characters" if CONTROL_CHAR_PATTERN.match?(value)
  end

  def validate_events!(events)
    return unless events.is_a?(Array)
    events.each_with_index do |event, index|
      next unless event.is_a?(Hash)
      payload = event.key?("payload") ? event["payload"] : event[:payload]
      next if payload.nil?
      if utf16_length(payload.to_s) > PAYLOAD_MAX_LENGTH
        raise ValidationError, "events[#{index}].payload must be #{PAYLOAD_MAX_LENGTH} characters or less"
      end
    end
  end

  def utf16_length(text)
    text.encode("UTF-16LE", invalid: :replace, undef: :replace).bytesize / 2
  end
end
