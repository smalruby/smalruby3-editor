require "spec_helper"

RSpec.describe "Member Heartbeat API", type: :request do
  let(:domain) { "test-member-hb-#{SecureRandom.hex(8)}.example.com" }
  let(:host_id) { "host-member-hb-#{SecureRandom.hex(8)}" }
  let(:member_id) { "member-hb-#{SecureRandom.hex(8)}" }
  let(:group_name) { "Test Member Heartbeat Group" }

  describe "sendMemberHeartbeat mutation" do
    it "メンバーがハートビートを更新できる" do
      # 1. グループ作成
      group = create_test_group(group_name, host_id, domain)
      group_id = group["id"]

      # 2. メンバー参加
      join_test_node(group_id, domain, member_id)

      # 3. メンバーハートビート送信
      query = File.read(File.join(__dir__, "../fixtures/mutations/send_member_heartbeat.graphql"))
      response = execute_graphql(query, {
        groupId: group_id,
        domain: domain,
        nodeId: member_id
      })

      expect(response["errors"]).to be_nil
      expect(response["data"]["sendMemberHeartbeat"]).not_to be_nil
      expect(response["data"]["sendMemberHeartbeat"]["nodeId"]).to eq(member_id)
      expect(response["data"]["sendMemberHeartbeat"]["expiresAt"]).to match_iso8601
      expect(response["data"]["sendMemberHeartbeat"]["heartbeatIntervalSeconds"]).to be_an(Integer)

      # 有効期限の確認（環境変数のTTL設定に依存するが、ここでは値がセットされていることだけ確認）

      # デフォルトでは600秒（10分）後
      expires_time = DateTime.iso8601(response["data"]["sendMemberHeartbeat"]["expiresAt"]).to_time
      expect(expires_time).to be > Time.now
    end

    it "存在しないグループに対してメンバーハートビートを送るとエラー" do
      query = File.read(File.join(__dir__, "../fixtures/mutations/send_member_heartbeat.graphql"))
      response = execute_graphql(query, {
        groupId: "non-existent-group",
        domain: domain,
        nodeId: member_id
      }, suppress_errors: true)

      expect(response["errors"]).not_to be_nil
      expect(response["errors"][0]["errorType"]).to eq("GroupNotFound")
    end

    it "存在しないノードに対してメンバーハートビートを送るとエラー" do
      # 1. グループ作成
      group = create_test_group(group_name, host_id, domain)
      group_id = group["id"]

      # 2. 参加していないノードIDでハートビート送信
      query = File.read(File.join(__dir__, "../fixtures/mutations/send_member_heartbeat.graphql"))
      response = execute_graphql(query, {
        groupId: group_id,
        domain: domain,
        nodeId: "non-existent-node"
      }, suppress_errors: true)

      # Note: 現状の実装では、Nodeの存在チェックはUpdateItemのConditionExpressionで行われる
      # DynamoDB:ConditionalCheckFailedException が返るはずだが、AppSync function側で
      # これを NodeNotFound に変換しているか確認が必要
      expect(response["errors"]).not_to be_nil
      expect(response["errors"][0]["errorType"]).to eq("NodeNotFound")
    end

    it "ホストのheartbeat期限切れ時にメンバーハートビートがGroupNotFoundエラーを返す" do
      # 1. グループ作成 (5秒で有効期限切れになるように設定)
      group = create_test_group(group_name, host_id, domain, max_connection_time_seconds: 5)
      group_id = group["id"]

      # 2. メンバー参加
      join_test_node(group_id, domain, member_id)

      # 3. 6秒待機してグループの expiresAt を期限切れにする
      # Note: checkGroupExists.js は2つの条件をチェック:
      #   (1) now > expiresAt (絶対時間チェック) ← このテストで検証
      #   (2) now - heartbeatAt > 60 (相対時間チェック)
      puts "Waiting 6 seconds for group to expire (expiresAt)..."
      sleep 6

      # 4. メンバーハートビート送信
      query = File.read(File.join(__dir__, "../fixtures/mutations/send_member_heartbeat.graphql"))
      response = execute_graphql(query, {
        groupId: group_id,
        domain: domain,
        nodeId: member_id
      }, suppress_errors: true)

      # GroupNotFoundエラーを期待
      expect(response["errors"]).not_to be_nil
      expect(response["errors"][0]["errorType"]).to eq("GroupNotFound")
      expect(response["errors"][0]["message"]).to include("Group")
    end
  end
end
