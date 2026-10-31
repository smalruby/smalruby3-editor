require "time"
require "securerandom"
require_relative "../domain/mesh_input"

class RecordEventsUseCase
  def initialize(repository)
    @repository = repository
  end

  def execute(group_id:, domain:, node_id:, events:, ttl_seconds: 10)
    MeshInput.validate_id!(node_id, "nodeId")

    # 1. グループの存在確認
    group = @repository.find_group(group_id, domain)
    return {success: false, error: "Group not found"} unless group

    # 2. イベントの保存
    result = @repository.record_events(group_id, domain, node_id, events, ttl_seconds)

    if result[:success]
      {
        success: true,
        groupId: group_id,
        domain: domain,
        recordedCount: result[:recordedCount],
        nextSince: result[:last_sk] || "EVENT##{Time.now.iso8601}"
      }
    else
      {success: false, error: result[:error] || "Failed to record events"}
    end
  end
end
