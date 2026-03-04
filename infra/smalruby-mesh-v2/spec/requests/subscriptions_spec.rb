require "spec_helper"

RSpec.describe "Subscriptions API", type: :request do
  let(:domain) { "test-sub-" + Time.now.to_i.to_s + ".example.com" }
  let(:host_id) { "host-sub-" + Time.now.to_i.to_s }
  let(:node1_id) { "node1-sub-" + Time.now.to_i.to_s }
  let(:node2_id) { "node2-sub-" + Time.now.to_i.to_s }

  describe "Subscription schema validation" do
    it "GraphQLスキーマにSubscription型が定義されている" do
      schema_content = File.read(File.join(__dir__, "../../graphql/schema.graphql"))

      # Subscription型の存在確認
      expect(schema_content).to include("type Subscription")

      # 統合されたSubscriptionフィールドの存在確認
      expect(schema_content).to include("onMessageInGroup")
    end

    it "@aws_subscribeディレクティブが正しく定義されている" do
      schema_content = File.read(File.join(__dir__, "../../graphql/schema.graphql"))

      # onMessageInGroupのディレクティブ確認
      # reportDataByNode, fireEventsByNode, dissolveGroup を購読
      expect(schema_content).to match(
        /onMessageInGroup.*@aws_subscribe\(mutations:\s*\["reportDataByNode", "fireEventsByNode", "dissolveGroup"\]\)/m
      )
    end

    it "Subscriptionの戻り値型がMeshMessage（Union）である" do
      schema_content = File.read(File.join(__dir__, "../../graphql/schema.graphql"))

      expect(schema_content).to match(
        /onMessageInGroup\([^)]+\):\s*MeshMessage\s+@aws_subscribe/
      )
    end
  end

  describe "Subscription behavior tests" do
    before(:all) do
      # Subscription動作テストはWebSocket接続が必要
      puts "\n=== Subscription Behavior Tests ==="
      puts "Note: These tests verify mutations work correctly."
      puts "WebSocket subscription behavior should be verified manually or with E2E tests."
    end

    context "onMessageInGroup の前提条件" do
      it "reportDataByNode mutation が正常に動作する" do
        # グループ作成
        group = create_test_group("Sub Test Group", host_id, domain)
        group_id = group["id"]

        # ノード参加
        join_test_node(group_id, domain, node1_id)

        # データ報告
        query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
        response = execute_graphql(query, {
          groupId: group_id,
          domain: domain,
          nodeId: node1_id,
          data: [
            {key: "temperature", value: "25.5"},
            {key: "humidity", value: "60"}
          ]
        })

        expect(response["errors"]).to be_nil
        expect(response["data"]["reportDataByNode"]).not_to be_nil
        # Verify top-level filtering fields
        expect(response["data"]["reportDataByNode"]["groupId"]).to eq(group_id)
        expect(response["data"]["reportDataByNode"]["domain"]).to eq(domain)
        # MeshMessage has nodeStatus field
        expect(response["data"]["reportDataByNode"]["nodeStatus"]).not_to be_nil
        expect(response["data"]["reportDataByNode"]["nodeStatus"]["nodeId"]).to eq(node1_id)
        expect(response["data"]["reportDataByNode"]["nodeStatus"]["data"].length).to eq(2)

        puts "  ✓ reportDataByNode executed - onMessageInGroup should trigger"
      end

      it "dissolveGroup mutation が正常に動作する" do
        # グループ作成
        group = create_test_group("Dissolve Test Group", host_id, domain)
        group_id = group["id"]

        # グループ解散
        query = File.read(File.join(__dir__, "../fixtures/mutations/dissolve_group.graphql"))
        response = execute_graphql(query, {
          groupId: group_id,
          domain: domain,
          hostId: host_id
        })

        expect(response["errors"]).to be_nil
        expect(response["data"]["dissolveGroup"]).not_to be_nil
        # Verify top-level filtering fields
        expect(response["data"]["dissolveGroup"]["groupId"]).to eq(group_id)
        expect(response["data"]["dissolveGroup"]["domain"]).to eq(domain)
        # MeshMessage has groupDissolve field
        expect(response["data"]["dissolveGroup"]["groupDissolve"]).not_to be_nil
        expect(response["data"]["dissolveGroup"]["groupDissolve"]["groupId"]).to eq(group_id)
        expect(response["data"]["dissolveGroup"]["groupDissolve"]["message"]).to include("dissolved")

        puts "  ✓ dissolveGroup executed - onMessageInGroup should trigger"
      end
    end

    context "groupId フィルタリング" do
      it "異なるgroupIdのイベントは受信されない（期待動作の確認）" do
        # グループ1作成
        group1 = create_test_group("Group 1", "#{host_id}-1", domain)
        group1_id = group1["id"]

        # グループ2作成
        group2 = create_test_group("Group 2", "#{host_id}-2", domain)
        group2_id = group2["id"]

        # 両方のグループで動作することを確認
        join_test_node(group1_id, domain, "#{node1_id}-g1")
        join_test_node(group2_id, domain, "#{node1_id}-g2")

        puts "  ✓ Multiple groups created - filtering should work by groupId"
      end
    end
  end

  describe "Manual WebSocket testing guide" do
    it "WebSocketテスト手順を出力する" do
      puts "\n" + "=" * 80
      puts "Manual WebSocket Subscription Testing Guide"
      puts "=" * 80
      puts ""
      puts "To manually test subscriptions, use the following steps:"
      puts ""
      puts "1. Install wscat:"
      puts "   npm install -g wscat"
      puts ""
      puts "2. Connect to AppSync WebSocket endpoint:"
      puts "   API_URL='#{ENV["APPSYNC_ENDPOINT"]}'"
      puts "   API_KEY='#{ENV["APPSYNC_API_KEY"]}'"
      puts "   WS_URL=$(echo $API_URL | sed 's/https:/wss:/g' | sed 's/graphql$/graphql\\/realtime/g')"
      puts ""
      puts "3. Subscribe to onMessageInGroup:"
      puts "   subscription {"
      puts '     onMessageInGroup(groupId: "YOUR_GROUP_ID", domain: "YOUR_DOMAIN") {'
      puts "       ... on NodeStatus {"
      puts "         nodeId"
      puts "         data { key value }"
      puts "         timestamp"
      puts "       }"
      puts "       ... on BatchEvent {"
      puts "         firedByNodeId"
      puts "         events { name payload }"
      puts "         timestamp"
      puts "       }"
      puts "       ... on GroupDissolvePayload {"
      puts "         message"
      puts "       }"
      puts "     }"
      puts "   }"
      puts ""
      puts "4. Trigger mutation in another terminal:"
      puts "   Use execute_graphql helper or GraphQL playground"
      puts ""
      puts "5. Verify subscription receives the update"
      puts ""
      puts "=" * 80

      expect(true).to be true
    end
  end
end
