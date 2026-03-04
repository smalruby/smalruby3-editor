require "time"

# DissolveGroup Use Case
# アプリケーション層 - グループ解散のビジネスロジック
class DissolveGroupUseCase
  def initialize(repository)
    @repository = repository
  end

  def execute(group_id:, domain:, host_id:)
    # 入力バリデーション
    validate_input!(group_id, domain, host_id)

    # グループの存在確認
    group = @repository.find_group(group_id, domain)
    raise StandardError, "Group not found: #{group_id}@#{domain}" unless group

    # ホスト権限の確認
    unless group.host_id == host_id
      raise StandardError, "Only the host can dissolve the group. Host: #{group.host_id}, Requested by: #{host_id}"
    end

    # グループ解散
    @repository.dissolve_group(group_id, domain)

    # レスポンスペイロード
    {
      groupId: group_id,
      domain: domain,
      message: "Group #{group_id}@#{domain} has been dissolved successfully."
    }
  end

  private

  def validate_input!(group_id, domain, host_id)
    raise ArgumentError, "groupId is required" if group_id.nil? || group_id.to_s.empty?
    raise ArgumentError, "domain is required" if domain.nil? || domain.to_s.empty?
    raise ArgumentError, "hostId is required" if host_id.nil? || host_id.to_s.empty?
  end
end
