require "spec_helper"

RSpec.describe "High-Frequency Mutations API", type: :request do
  let(:api_endpoint) { ENV["APPSYNC_ENDPOINT"] }
  let(:api_key) { ENV["APPSYNC_API_KEY"] }

  describe "reportDataByNode mutation" do
    it "ノードのデータを報告できる" do
      # テストグループを作成
      timestamp = Time.now.to_i
      test_domain = "test-#{timestamp}.example.com"
      group = create_test_group("Test Group", "host-#{timestamp}-001", test_domain)
      group_id = group["id"]

      # ノードをグループに参加させる
      node_id = "node-#{timestamp}-001"
      join_test_node(group_id, test_domain, node_id)

      # データを報告
      query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
      variables = {
        groupId: group_id,
        domain: test_domain,
        nodeId: node_id,
        data: [
          {key: "temperature", value: "25.5"},
          {key: "humidity", value: "60.0"}
        ]
      }

      response = execute_graphql(query, variables)

      expect(response["errors"]).to be_nil
      expect(response["data"]["reportDataByNode"]).not_to be_nil
      # Verify top-level filtering fields
      expect(response["data"]["reportDataByNode"]["groupId"]).to eq(group_id)
      expect(response["data"]["reportDataByNode"]["domain"]).to eq(test_domain)

      expect(response["data"]["reportDataByNode"]["nodeStatus"]).not_to be_nil
      node_status = response["data"]["reportDataByNode"]["nodeStatus"]
      expect(node_status["nodeId"]).to eq(node_id)
      expect(node_status["groupId"]).to eq(group_id)
      expect(node_status["domain"]).to eq(test_domain)
      expect(node_status["data"]).to be_an(Array)
      expect(node_status["data"].size).to eq(2)
      expect(node_status["data"]).to include(
        {"key" => "temperature", "value" => "25.5"},
        {"key" => "humidity", "value" => "60.0"}
      )
      expect(node_status["timestamp"]).to match_iso8601
    end

    it "高頻度でデータを報告できる（15 ops/sec）" do
      timestamp = Time.now.to_i
      test_domain = "test-#{timestamp}.example.com"
      group = create_test_group("Test Group", "host-#{timestamp}-002", test_domain)
      group_id = group["id"]

      node_id = "node-#{timestamp}-002"
      join_test_node(group_id, test_domain, node_id)

      query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))

      # 15回連続でデータを報告
      responses = 15.times.map do |i|
        variables = {
          groupId: group_id,
          domain: test_domain,
          nodeId: node_id,
          data: [{key: "counter", value: i.to_s}]
        }
        execute_graphql(query, variables)
      end

      # すべて成功することを確認
      responses.each do |response|
        expect(response["errors"]).to be_nil
        expect(response["data"]["reportDataByNode"]["nodeStatus"]["nodeId"]).to eq(node_id)
      end
    end
  end
end
