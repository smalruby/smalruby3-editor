require "zlib"

# CreateDomain Use Case
# リクエスト元のソースIPからドメイン文字列を生成する
class CreateDomainUseCase
  def initialize(secret_key: nil)
    @secret_key = secret_key || ENV["MESH_SECRET_KEY"] || "default-secret-key"
  end

  def execute(source_ip:)
    # ソースIPが取得できない場合は "none" を使用（既存実装に合わせる）
    ip = source_ip || "none"

    # CRC32でハッシュ化して16進数文字列にする
    Zlib.crc32(@secret_key + ip).to_s(16)
  end
end
