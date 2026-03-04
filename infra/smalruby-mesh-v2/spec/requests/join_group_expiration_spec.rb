require "spec_helper"

RSpec.describe "joinGroup expiration validation", type: :request do
  let(:domain) { "test-join-expiration-#{Time.now.to_i}.example.com" }
  let(:host_id) { "host-#{Time.now.to_i}" }
  let(:node_id) { "node-#{Time.now.to_i}" }
  let(:group_name) { "Expired Group Test" }

  context "期限切れグループへの参加" do
    it "エラーを返す" do
      # 1. 有効期限の短いグループを作成 (1秒)
      group = create_test_group(group_name, host_id, domain, max_connection_time_seconds: 1)
      group_id = group["id"]
      expect(group_id).not_to be_nil

      # 有効期限を待つ (2秒)
      sleep 2

      # 2. 期限切れグループへの参加を試みる
      join_query = File.read(File.join(__dir__, "../fixtures/mutations/join_group.graphql"))
      join_response = execute_graphql(join_query, {
        groupId: group_id,
        domain: domain,
        nodeId: node_id
      }, suppress_errors: true)

      # 3. エラーレスポンス検証
      expect(join_response["errors"]).not_to be_nil
      expect(join_response["errors"][0]["message"]).to include("Group expired")
      expect(join_response["errors"][0]["errorType"]).to eq("GroupNotFound")
    end
  end
end
