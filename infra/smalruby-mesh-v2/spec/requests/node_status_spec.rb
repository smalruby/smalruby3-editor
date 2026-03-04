require "spec_helper"

RSpec.describe "Node Status Management", type: :request do
  let(:timestamp) { (Time.now.to_f * 1000).to_i }
  let(:domain) { "test-node-status-#{timestamp}.example.com" }
  let(:host_id) { "host-#{timestamp}" }
  let(:node1_id) { "node1-#{timestamp}" }
  let(:node2_id) { "node2-#{timestamp}" }

  describe "reportDataByNode and listGroupStatuses integration" do
    it "データ送信後、listGroupStatusesで取得できる" do
      # Setup: グループ作成
      group = create_test_group("Node Status Test Group", host_id, domain)
      group_id = group["id"]

      # Setup: ノード参加
      join_test_node(group_id, domain, node1_id)
      join_test_node(group_id, domain, node2_id)

      # Execute: Node1がデータを送信
      report_query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
      report_response = execute_graphql(report_query, {
        groupId: group_id,
        domain: domain,
        nodeId: node1_id,
        data: [
          {key: "temperature", value: "25.5"},
          {key: "humidity", value: "60"}
        ]
      })

      # Verify: Mutation成功
      expect(report_response["errors"]).to be_nil
      expect(report_response["data"]["reportDataByNode"]).not_to be_nil

      # Execute: listGroupStatusesでグループ内の全NodeStatus取得
      list_query = File.read(File.join(__dir__, "../fixtures/queries/list_group_statuses.graphql"))
      list_response = execute_graphql(list_query, {
        groupId: group_id,
        domain: domain
      })

      # Debug output
      puts "\n[listGroupStatuses Response]"
      puts JSON.pretty_generate(list_response)

      # Verify: Query成功（エラーなし）
      expect(list_response["errors"]).to be_nil,
        "listGroupStatuses should not return errors. Response: #{list_response.inspect}"

      # Verify: データが取得できる
      expect(list_response["data"]).not_to be_nil
      expect(list_response["data"]["listGroupStatuses"]).not_to be_nil

      statuses = list_response["data"]["listGroupStatuses"]

      # Verify: 配列として取得できる（空配列も許容）
      expect(statuses).to be_an(Array),
        "listGroupStatuses should return an array"

      # Verify: Node1のデータが含まれている
      node1_status = statuses.find { |s| s["nodeId"] == node1_id }
      expect(node1_status).not_to be_nil,
        "Node1's status should be in the list"

      # Verify: Node1のデータ内容が正しい
      expect(node1_status["groupId"]).to eq(group_id)
      expect(node1_status["domain"]).to eq(domain)
      expect(node1_status["data"]).to be_an(Array)
      expect(node1_status["data"].length).to eq(2)

      # Verify: センサーデータが正しい
      temp_data = node1_status["data"].find { |d| d["key"] == "temperature" }
      humidity_data = node1_status["data"].find { |d| d["key"] == "humidity" }

      expect(temp_data).not_to be_nil
      expect(temp_data["value"]).to eq("25.5")

      expect(humidity_data).not_to be_nil
      expect(humidity_data["value"]).to eq("60")

      # Verify: timestampが存在する
      expect(node1_status["timestamp"]).to match_iso8601

      puts "\n✓ Node Status integration test passed!"
      puts "  - Node1 data successfully stored and retrieved"
      puts "  - Temperature: #{temp_data["value"]}"
      puts "  - Humidity: #{humidity_data["value"]}"
    end

    it "複数ノードのデータを正しく取得できる" do
      # Setup
      group = create_test_group("Multi-Node Status Test", host_id, domain)
      group_id = group["id"]
      join_test_node(group_id, domain, node1_id)
      join_test_node(group_id, domain, node2_id)

      # Execute: Node1がデータ送信
      report_query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
      execute_graphql(report_query, {
        groupId: group_id,
        domain: domain,
        nodeId: node1_id,
        data: [{key: "sensor1", value: "value1"}]
      })

      # Execute: Node2がデータ送信
      execute_graphql(report_query, {
        groupId: group_id,
        domain: domain,
        nodeId: node2_id,
        data: [{key: "sensor2", value: "value2"}]
      })

      # Query: 全NodeStatus取得
      list_query = File.read(File.join(__dir__, "../fixtures/queries/list_group_statuses.graphql"))
      list_response = execute_graphql(list_query, {
        groupId: group_id,
        domain: domain
      })

      # Verify
      expect(list_response["errors"]).to be_nil
      statuses = list_response["data"]["listGroupStatuses"]
      expect(statuses).to be_an(Array)
      expect(statuses.length).to eq(2), "Should have 2 node statuses"

      # Verify: 両方のノードが含まれている
      node_ids = statuses.map { |s| s["nodeId"] }
      expect(node_ids).to include(node1_id)
      expect(node_ids).to include(node2_id)

      puts "\n✓ Multi-node status test passed!"
      puts "  - Retrieved #{statuses.length} node statuses"
    end

    it "データ送信していないグループでは空配列を返す" do
      # Setup: グループ作成（データ送信なし）
      group = create_test_group("Empty Status Test", host_id, domain)
      group_id = group["id"]
      join_test_node(group_id, domain, node1_id)

      # Query: listGroupStatuses
      list_query = File.read(File.join(__dir__, "../fixtures/queries/list_group_statuses.graphql"))
      list_response = execute_graphql(list_query, {
        groupId: group_id,
        domain: domain
      })

      # Verify: 空配列を返す（nullではない）
      statuses = list_response["data"]["listGroupStatuses"]
      expect(statuses).to be_an(Array)
      expect(statuses).to be_empty,
        "Should return empty array when no data has been reported"

      puts "\n✓ Empty status test passed!"
      puts "  - Returns empty array (not null) for groups without data"
    end
  end
end
