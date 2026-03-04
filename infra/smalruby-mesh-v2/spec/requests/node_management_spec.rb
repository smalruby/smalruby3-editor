require "spec_helper"

RSpec.describe "Node Management API", type: :request do
  let(:timestamp) { (Time.now.to_f * 1000).to_i }
  let(:domain) { "test-node-mgmt-#{timestamp}.example.com" }
  let(:host_id) { "host-#{timestamp}" }
  let(:node_id) { "node-#{timestamp}" }
  let(:group_name) { "Node Management Test Group" }

  describe "getNodeStatus query" do
    it "特定のノードのステータスを取得できる" do
      # Setup: グループ作成とノード参加
      group = create_test_group(group_name, host_id, domain)
      group_id = group["id"]
      join_test_node(group_id, domain, node_id)

      # Setup: データを報告
      report_query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
      execute_graphql(report_query, {
        groupId: group_id,
        domain: domain,
        nodeId: node_id,
        data: [{key: "power", value: "on"}]
      })

      # Execute: getNodeStatusを実行
      query = File.read(File.join(__dir__, "../fixtures/queries/get_node_status.graphql"))
      response = execute_graphql(query, {nodeId: node_id})

      # Verify
      expect(response["errors"]).to be_nil
      status = response["data"]["getNodeStatus"]
      expect(status["nodeId"]).to eq(node_id)
      expect(status["groupId"]).to eq(group_id)
      expect(status["data"]).to include({"key" => "power", "value" => "on"})
    end

    it "存在しないノードの場合はnullを返す" do
      query = File.read(File.join(__dir__, "../fixtures/queries/get_node_status.graphql"))
      response = execute_graphql(query, {nodeId: "non-existent-node"})

      expect(response["errors"]).to be_nil
      expect(response["data"]["getNodeStatus"]).to be_nil
    end
  end

  describe "listNodesInGroup query" do
    it "グループ内のノード一覧を取得できる" do
      # Setup: グループ作成
      group = create_test_group(group_name, host_id, domain)
      group_id = group["id"]

      # Setup: 複数のノードを参加させる
      nodes = ["node-A", "node-B"].map { |n| "#{n}-#{Time.now.to_i}" }
      nodes.each { |id| join_test_node(group_id, domain, id) }

      # Execute: listNodesInGroupを実行
      query = File.read(File.join(__dir__, "../fixtures/queries/list_nodes_in_group.graphql"))
      response = execute_graphql(query, {groupId: group_id, domain: domain})

      # Verify
      expect(response["errors"]).to be_nil
      retrieved_nodes = response["data"]["listNodesInGroup"]
      expect(retrieved_nodes).to be_an(Array)

      retrieved_ids = retrieved_nodes.map { |n| n["id"] }
      nodes.each do |id|
        expect(retrieved_ids).to include(id)
      end
    end

    it "空のグループの場合は空配列を返す" do
      group = create_test_group("Empty Group", host_id, domain)
      group_id = group["id"]

      query = File.read(File.join(__dir__, "../fixtures/queries/list_nodes_in_group.graphql"))
      response = execute_graphql(query, {groupId: group_id, domain: domain})

      expect(response["errors"]).to be_nil
      expect(response["data"]["listNodesInGroup"]).to eq([])
    end
  end
end
