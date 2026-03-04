require "spec_helper"

RSpec.describe "Subscription Trigger Validation", type: :request do
  let(:domain) { "test-subscription-trigger-#{Time.now.to_i}.example.com" }
  let(:host_id) { "host-#{Time.now.to_i}" }
  let(:node_id) { "node-#{Time.now.to_i}" }

  describe "Mutation response fields for subscription filtering" do
    context "reportDataByNode mutation" do
      it "groupIdとdomainフィールドを含むNodeStatusを返す（subscription filteringに必要）" do
        # グループ作成
        group = create_test_group("Subscription Test Group", host_id, domain)
        group_id = group["id"]

        # ノード参加
        join_test_node(group_id, domain, node_id)

        # データ報告
        query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
        response = execute_graphql(query, {
          groupId: group_id,
          domain: domain,
          nodeId: node_id,
          data: [
            {key: "temperature", value: "25.5"},
            {key: "humidity", value: "60"}
          ]
        })

        # Mutationが成功
        expect(response["errors"]).to be_nil
        mesh_message = response["data"]["reportDataByNode"]
        # Verify top-level filtering fields
        expect(mesh_message["groupId"]).to eq(group_id)
        expect(mesh_message["domain"]).to eq(domain)

        expect(mesh_message["nodeStatus"]).not_to be_nil
        result = mesh_message["nodeStatus"]

        # Subscription filteringに必要なフィールドが含まれているか確認
        expect(result).to have_key("groupId")
        expect(result).to have_key("domain")
        expect(result).to have_key("nodeId")
        expect(result).to have_key("data")
        expect(result).to have_key("timestamp")

        # 値が正しいか確認
        expect(result["groupId"]).to eq(group_id)
        expect(result["domain"]).to eq(domain)
        expect(result["nodeId"]).to eq(node_id)

        puts "\n✓ reportDataByNode returns all required fields for subscription filtering"
        puts "  - groupId: #{result["groupId"]}"
        puts "  - domain: #{result["domain"]}"
        puts "  - nodeId: #{result["nodeId"]}"
      end

      it "mutation responseのgroupIdとdomainが入力パラメータと一致する" do
        group = create_test_group("Match Test Group", host_id, domain)
        group_id = group["id"]
        join_test_node(group_id, domain, node_id)

        query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
        response = execute_graphql(query, {
          groupId: group_id,
          domain: domain,
          nodeId: node_id,
          data: [{key: "test", value: "value"}]
        })

        mesh_message = response["data"]["reportDataByNode"]
        # Subscription filteringのために、入力パラメータと戻り値が一致する必要がある
        expect(mesh_message["groupId"]).to eq(group_id),
          "Mutation response groupId must match input for subscription filtering"
        expect(mesh_message["domain"]).to eq(domain),
          "Mutation response domain must match input for subscription filtering"

        expect(mesh_message["nodeStatus"]).not_to be_nil
        mesh_message["nodeStatus"]
      end
    end

    context "dissolveGroup mutation" do
      it "groupIdとdomainフィールドを含むGroupDissolvePayloadを返す（subscription filteringに必要）" do
        group = create_test_group("Dissolve Test Group", host_id, domain)
        group_id = group["id"]

        query = File.read(File.join(__dir__, "../fixtures/mutations/dissolve_group.graphql"))
        response = execute_graphql(query, {
          groupId: group_id,
          domain: domain,
          hostId: host_id
        })

        expect(response["errors"]).to be_nil
        mesh_message = response["data"]["dissolveGroup"]
        # Verify top-level filtering fields
        expect(mesh_message["groupId"]).to eq(group_id)
        expect(mesh_message["domain"]).to eq(domain)

        expect(mesh_message["groupDissolve"]).not_to be_nil
        result = mesh_message["groupDissolve"]

        # Subscription filteringに必要なフィールド
        expect(result).to have_key("groupId")
        expect(result).to have_key("domain")
        expect(result).to have_key("message")

        expect(result["groupId"]).to eq(group_id)
        expect(result["domain"]).to eq(domain)
      end
    end
  end

  describe "Subscription field selection validation" do
    it "GraphQLスキーマでSubscriptionがgroupIdとdomainを引数に取る" do
      schema_content = File.read(File.join(__dir__, "../../graphql/schema.graphql"))

      # onMessageInGroupの引数確認
      expect(schema_content).to match(
        /onMessageInGroup\(groupId:\s*ID!,\s*domain:\s*String!\)/
      ), "onMessageInGroup must accept groupId and domain arguments for filtering"
    end

    it "NodeStatus型がgroupIdとdomainフィールドを含む" do
      schema_content = File.read(File.join(__dir__, "../../graphql/schema.graphql"))

      # NodeStatus型の定義を抽出
      node_status_match = schema_content.match(/type NodeStatus\s+[^{]*\{([^}]+)\}/m)
      expect(node_status_match).not_to be_nil

      node_status_def = node_status_match[1]

      # 必須フィールドの確認
      expect(node_status_def).to include("groupId: ID!"),
        "NodeStatus must include groupId field for subscription filtering"
      expect(node_status_def).to include("domain: String!"),
        "NodeStatus must include domain field for subscription filtering"
    end
  end

  describe "Subscription trigger mechanism validation" do
    it "@aws_subscribe directiveが正しいmutationを指定している" do
      schema_content = File.read(File.join(__dir__, "../../graphql/schema.graphql"))

      # onMessageInGroup -> reportDataByNode, fireEventsByNode, dissolveGroup
      expect(schema_content).to match(
        /onMessageInGroup[^@]+@aws_subscribe\(mutations:\s*\["reportDataByNode", "fireEventsByNode", "dissolveGroup"\]\)/m
      ), "onMessageInGroup must subscribe to required mutations"
    end

    it "MutationとSubscriptionの戻り値型が一致している" do
      schema_content = File.read(File.join(__dir__, "../../graphql/schema.graphql"))

      # reportDataByNode mutation と onMessageInGroup subscription
      mutation_match = schema_content.match(/reportDataByNode[^:]+:\s*(\w+)/)
      subscription_match = schema_content.match(/onMessageInGroup[^:]+:\s*(\w+)/)

      expect(mutation_match).not_to be_nil
      expect(subscription_match).not_to be_nil

      mutation_type = mutation_match[1]
      subscription_type = subscription_match[1]

      expect(mutation_type).to eq(subscription_type),
        "reportDataByNode mutation return type (#{mutation_type}) must match onMessageInGroup subscription type (#{subscription_type})"
    end
  end

  describe "Integration test documentation" do
    it "Subscription動作確認のための手順を出力" do
      puts "\n" + "=" * 80
      puts "Subscription Integration Test Guide"
      puts "=" * 80
      puts ""
      puts "このテストスイートでは、以下を確認しています："
      puts "1. Mutationが subscription filtering に必要なフィールド（groupId, domain）を返す"
      puts "2. GraphQL スキーマの @aws_subscribe directive が正しく設定されている"
      puts "3. Mutation と Subscription の戻り値型が一致している"
      puts ""
      puts "実際の Subscription 配信動作を確認するには："
      puts "1. examples/javascript-client/debug-subscription.html を使用"
      puts "2. CloudWatch Logs で subscription publish ログを確認"
      puts "   aws logs tail /aws/appsync/apis/2kw5fyno4bhjbc47mvu3rxytye --follow"
      puts ""
      puts "期待される動作："
      puts "- reportDataByNode mutation 完了後、AppSync が onMessageInGroup に publish"
      puts "- groupId と domain が一致する subscription のみがデータを受信"
      puts "=" * 80

      expect(true).to be true
    end
  end
end
