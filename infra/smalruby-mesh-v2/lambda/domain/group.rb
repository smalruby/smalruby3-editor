# Group Domain Model
# ドメインモデル - ビジネスルールとバリデーションを持つ
class Group
  attr_reader :id, :name, :host_id, :domain, :created_at, :use_websocket, :polling_interval_seconds

  def initialize(id:, name:, host_id:, domain:, created_at:, use_websocket: true, polling_interval_seconds: nil)
    @id = id
    @name = name
    @host_id = host_id
    @domain = domain
    @created_at = created_at
    @use_websocket = use_websocket
    @polling_interval_seconds = polling_interval_seconds

    validate!
  end

  # fullId: {id}@{domain} 形式の完全なID
  def full_id
    "#{@id}@#{@domain}"
  end

  private

  def validate!
    raise ArgumentError, "id is required" if @id.nil? || @id.to_s.empty?
    raise ArgumentError, "name is required" if @name.nil? || @name.empty?
    raise ArgumentError, "host_id is required" if @host_id.nil? || @host_id.to_s.empty?
    raise ArgumentError, "domain is required" if @domain.nil? || @domain.empty?
    raise ArgumentError, "domain must be 256 characters or less" if @domain.length > 256
    raise ArgumentError, "created_at is required" if @created_at.nil? || @created_at.empty?
  end
end
