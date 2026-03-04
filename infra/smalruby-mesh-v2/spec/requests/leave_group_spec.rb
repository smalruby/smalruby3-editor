require "spec_helper"

RSpec.describe "Leave Group API", type: :request do
  let(:api_endpoint) { ENV["APPSYNC_ENDPOINT"] }
  let(:api_key) { ENV["APPSYNC_API_KEY"] }

  describe "leaveGroup mutation" do
    let(:timestamp) { Time.now.to_i }
    let(:domain) { "test-leave-#{timestamp}.example.com" }
    let(:host_id) { "host-#{timestamp}" }
    let(:node_id) { "node-#{timestamp}" }
    let(:group_name) { "Leave Test Group" }

    it "グループから正常に退出でき、データも削除される" do
      # 1. グループ作成
      create_query = File.read(File.join(__dir__, "../fixtures/mutations/create_group.graphql"))
      create_res = execute_graphql(create_query, {
        name: group_name,
        hostId: host_id,
        domain: domain,
        useWebSocket: true
      })
      group_id = create_res["data"]["createGroup"]["id"]

      # 2. グループに参加
      join_query = File.read(File.join(__dir__, "../fixtures/mutations/join_group.graphql"))
      execute_graphql(join_query, {
        groupId: group_id,
        nodeId: node_id,
        domain: domain
      })

      # 3. データ報告
      report_query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
      execute_graphql(report_query, {
        nodeId: node_id,
        groupId: group_id,
        domain: domain,
        data: [{key: "temp", value: "25"}]
      })

      # データが存在することを確認
      list_query = File.read(File.join(__dir__, "../fixtures/queries/list_group_statuses.graphql"))
      list_res_before = execute_graphql(list_query, {
        groupId: group_id,
        domain: domain
      })
      expect(list_res_before["data"]["listGroupStatuses"].any? { |s| s["nodeId"] == node_id }).to be true

      # 4. グループから退出
      leave_query = File.read(File.join(__dir__, "../fixtures/mutations/leave_group.graphql"))
      leave_res = execute_graphql(leave_query, {
        groupId: group_id,
        nodeId: node_id,
        domain: domain
      })

      expect(leave_res["errors"]).to be_nil
      expect(leave_res["data"]["leaveGroup"]).to include(
        "peerId" => node_id,
        "groupId" => group_id,
        "domain" => domain
      )

      # 5. データが削除されていることを確認
      list_res_after = execute_graphql(list_query, {
        groupId: group_id,
        domain: domain
      })
      # node_id のデータが消えていること
      expect(list_res_after["data"]["listGroupStatuses"].any? { |s| s["nodeId"] == node_id }).to be false
    end
  end
end
