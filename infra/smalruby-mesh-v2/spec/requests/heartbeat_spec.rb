require "spec_helper"

RSpec.describe "Heartbeat API", type: :request do
  let(:domain) { "test-heartbeat-#{Time.now.to_i}.example.com" }
  let(:host_id) { "host-hb-#{Time.now.to_i}" }
  let(:member_id) { "member-hb-#{Time.now.to_i}" }
  let(:group_name) { "Test Heartbeat Group" }

  describe "renewHeartbeat mutation" do
    it "ホストがハートビートを更新できる" do
      # 1. グループ作成
      group = create_test_group(group_name, host_id, domain)
      group_id = group["id"]
      initial_expires_at = group["expiresAt"]

      expect(initial_expires_at).to match_iso8601

      # 2. ハートビート更新
      query = File.read(File.join(__dir__, "../fixtures/mutations/renew_heartbeat.graphql"))
      response = execute_graphql(query, {
        groupId: group_id,
        domain: domain,
        hostId: host_id
      })

      expect(response["errors"]).to be_nil
      expect(response["data"]["renewHeartbeat"]).not_to be_nil
      expect(response["data"]["renewHeartbeat"]["groupId"]).to eq(group_id)

      # expiresAtが返ってくることを確認
      new_expires_at = response["data"]["renewHeartbeat"]["expiresAt"]
      expect(new_expires_at).to match_iso8601
      expect(response["data"]["renewHeartbeat"]["heartbeatIntervalSeconds"]).to be_an(Integer)

      # 有効期限が現在時刻より後であることを確認
      expires_time = DateTime.iso8601(new_expires_at).to_time
      expect(expires_time).to be > Time.now
    end

    it "ホスト以外のノードがハートビートを更新しようとするとエラー" do
      # 1. グループ作成
      group = create_test_group(group_name, host_id, domain)
      group_id = group["id"]

      # 2. メンバーが参加
      join_test_node(group_id, domain, member_id)

      # 3. メンバーがハートビート更新を試みる
      query = File.read(File.join(__dir__, "../fixtures/mutations/renew_heartbeat.graphql"))
      response = execute_graphql(query, {
        groupId: group_id,
        domain: domain,
        hostId: member_id # ホストではない
      }, suppress_errors: true)

      expect(response["errors"]).not_to be_nil
      expect(response["errors"][0]["errorType"]).to eq("Unauthorized")
      expect(response["errors"][0]["message"]).to include("Only the host")
    end

    it "存在しないグループに対してハートビートを更新しようとするとエラー" do
      query = File.read(File.join(__dir__, "../fixtures/mutations/renew_heartbeat.graphql"))
      response = execute_graphql(query, {
        groupId: "non-existent-group",
        domain: domain,
        hostId: host_id
      }, suppress_errors: true)

      expect(response["errors"]).not_to be_nil
      expect(response["errors"][0]["errorType"]).to eq("GroupNotFound")
    end
  end

  describe "expiresAt field visibility" do
    it "createGroup, listGroupsByDomain で expiresAt が取得できる" do
      # 1. createGroup
      group = create_test_group(group_name, host_id, domain)
      expect(group["expiresAt"]).to match_iso8601

      # 2. listGroupsByDomain
      list_query = File.read(File.join(__dir__, "../fixtures/queries/list_groups_by_domain.graphql"))
      list_res = execute_graphql(list_query, {domain: domain})
      expect(list_res["data"]["listGroupsByDomain"][0]["expiresAt"]).to match_iso8601
    end
  end
end
