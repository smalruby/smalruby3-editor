require "spec_helper"

RSpec.describe "Protocol Logging API", type: :request do
  let(:timestamp) { (Time.now.to_f * 1000).to_i }
  let(:domain) { "test-protocol-#{timestamp}.example.com" }
  let(:host_id) { "host-protocol-#{timestamp}" }
  let(:group_name) { "Protocol Logging Test Group" }

  describe "createGroup mutation with useWebSocket" do
    it "useWebSocket=true を受け取り、Group.useWebSocket=true を返す" do
      query = File.read(File.join(__dir__, "../fixtures/mutations/create_group.graphql"))
      variables = {
        name: group_name,
        hostId: "#{host_id}-ws-true",
        domain: domain,
        useWebSocket: true
      }

      response = execute_graphql(query, variables)

      expect(response["errors"]).to be_nil
      expect(response["data"]["createGroup"]["useWebSocket"]).to eq(true)
      # WebSocket モードでは pollingIntervalSeconds は null
      expect(response["data"]["createGroup"]["pollingIntervalSeconds"]).to be_nil
    end

    it "useWebSocket=false を受け取り、Group.useWebSocket=false と pollingIntervalSeconds を返す" do
      query = File.read(File.join(__dir__, "../fixtures/mutations/create_group.graphql"))
      variables = {
        name: group_name,
        hostId: "#{host_id}-ws-false",
        domain: domain,
        useWebSocket: false
      }

      response = execute_graphql(query, variables)

      expect(response["errors"]).to be_nil
      expect(response["data"]["createGroup"]["useWebSocket"]).to eq(false)
      # ポーリングモードでは pollingIntervalSeconds が設定される（環境変数 MESH_POLLING_INTERVAL_SECONDS）
      expect(response["data"]["createGroup"]["pollingIntervalSeconds"]).to be_a(Integer)
      expect(response["data"]["createGroup"]["pollingIntervalSeconds"]).to be > 0
    end
  end

  describe "joinGroup mutation with useWebSocket (issue #555)" do
    it "useWebSocket=true を送信して参加できる" do
      group = create_test_group(group_name, "#{host_id}-join-true", domain, use_websocket: true)
      group_id = group["id"]
      node_id = "node-#{timestamp}-ws-true"

      query = File.read(File.join(__dir__, "../fixtures/mutations/join_group.graphql"))
      response = execute_graphql(query, {
        groupId: group_id,
        domain: domain,
        nodeId: node_id,
        useWebSocket: true
      })

      expect(response["errors"]).to be_nil
      expect(response["data"]["joinGroup"]).not_to be_nil
      expect(response["data"]["joinGroup"]["id"]).to eq(node_id)
      expect(response["data"]["joinGroup"]["groupId"]).to eq(group_id)
    end

    it "useWebSocket=false を送信して参加できる" do
      group = create_test_group(group_name, "#{host_id}-join-false", domain, use_websocket: false)
      group_id = group["id"]
      node_id = "node-#{timestamp}-ws-false"

      query = File.read(File.join(__dir__, "../fixtures/mutations/join_group.graphql"))
      response = execute_graphql(query, {
        groupId: group_id,
        domain: domain,
        nodeId: node_id,
        useWebSocket: false
      })

      expect(response["errors"]).to be_nil
      expect(response["data"]["joinGroup"]).not_to be_nil
      expect(response["data"]["joinGroup"]["id"]).to eq(node_id)
      expect(response["data"]["joinGroup"]["groupId"]).to eq(group_id)
    end

    it "useWebSocket を省略しても参加できる（後方互換性: 旧クライアント）" do
      group = create_test_group(group_name, "#{host_id}-join-omit", domain, use_websocket: true)
      group_id = group["id"]
      node_id = "node-#{timestamp}-omit"

      # useWebSocket を含まない旧形式の mutation を使用
      old_query = <<~GRAPHQL
        mutation JoinGroupOld($groupId: ID!, $domain: String!, $nodeId: ID!) {
          joinGroup(groupId: $groupId, domain: $domain, nodeId: $nodeId) {
            id
            name
            groupId
            domain
            expiresAt
            heartbeatIntervalSeconds
          }
        }
      GRAPHQL

      response = execute_graphql(old_query, {
        groupId: group_id,
        domain: domain,
        nodeId: node_id
      })

      expect(response["errors"]).to be_nil
      expect(response["data"]["joinGroup"]).not_to be_nil
      expect(response["data"]["joinGroup"]["id"]).to eq(node_id)
      expect(response["data"]["joinGroup"]["groupId"]).to eq(group_id)
    end

    it "useWebSocket=null を送信しても参加できる" do
      group = create_test_group(group_name, "#{host_id}-join-null", domain, use_websocket: true)
      group_id = group["id"]
      node_id = "node-#{timestamp}-null"

      query = File.read(File.join(__dir__, "../fixtures/mutations/join_group.graphql"))
      response = execute_graphql(query, {
        groupId: group_id,
        domain: domain,
        nodeId: node_id,
        useWebSocket: nil
      })

      expect(response["errors"]).to be_nil
      expect(response["data"]["joinGroup"]).not_to be_nil
      expect(response["data"]["joinGroup"]["id"]).to eq(node_id)
    end
  end
end
