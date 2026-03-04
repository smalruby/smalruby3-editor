require "time"

# LeaveGroup Use Case
# ビジネスロジック - ピアがグループから退出する処理フローを管理
class LeaveGroupUseCase
  def initialize(repository)
    @repository = repository
  end

  def execute(group_id:, domain:, peer_id:)
    # ビジネスロジック: ピアをグループから削除
    peer_removed = @repository.remove_node_from_group(group_id, domain, peer_id)

    unless peer_removed
      return {
        success: false,
        error: "Failed to remove peer from group",
        peer_id: peer_id,
        group_id: group_id,
        domain: domain
      }
    end

    # ビジネスロジック: ピアのデータを削除
    data_deleted = @repository.delete_peer_data(group_id, domain, peer_id)

    unless data_deleted
      return {
        success: false,
        error: "Failed to delete peer data",
        peer_id: peer_id,
        group_id: group_id,
        domain: domain
      }
    end

    # 成功レスポンス
    {
      success: true,
      message: "Peer #{peer_id} successfully left group #{group_id}",
      peer_id: peer_id,
      group_id: group_id,
      domain: domain
    }
  end
end
