require "spec_helper"

RSpec.describe "Subscription E2E Test", type: :request do
  let(:domain) { "test-e2e-#{Time.now.to_i}.example.com" }
  let(:host_id) { "host-e2e-#{Time.now.to_i}" }
  let(:node_id) { "node-e2e-#{Time.now.to_i}" }
  let(:subscription_helper) do
    AppSyncSubscriptionHelper.new(
      ENV["APPSYNC_ENDPOINT"],
      ENV["APPSYNC_API_KEY"]
    )
  end

  describe "reportDataByNode mutation triggers onMessageInGroup subscription (NodeStatus)" do
    it "subscriptionに参加後、mutationを実行すると通知を受信する" do
      # Setup: Group作成とNode参加
      group = create_test_group("E2E Subscription Test", host_id, domain)
      group_id = group["id"]
      join_test_node(group_id, domain, node_id)

      puts "\n" + "=" * 80
      puts "E2E Subscription Test"
      puts "=" * 80
      puts "Group ID: #{group_id}"
      puts "Domain: #{domain}"
      puts "Node ID: #{node_id}"
      puts ""

      # Subscription query
      subscription_query = <<~GRAPHQL
        subscription OnMessageInGroup($groupId: ID!, $domain: String!) {
          onMessageInGroup(groupId: $groupId, domain: $domain) {
            groupId
            domain
            nodeStatus {
              nodeId
              groupId
              domain
              data {
                key
                value
              }
              timestamp
            }
          }
        }
      GRAPHQL

      # Mutation query
      mutation_query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))

      # Execute: Subscriptionを確立し、その後mutationを実行
      received_data = subscription_helper.subscribe_and_execute(
        subscription_query,
        {groupId: group_id, domain: domain},
        wait_time: 2,
        timeout: 15
      ) do
        puts "\n[Test] Executing reportDataByNode mutation..."

        # Mutationを実行（HTTP経由）
        response = execute_graphql(mutation_query, {
          groupId: group_id,
          domain: domain,
          nodeId: node_id,
          data: [
            {key: "temperature", value: "25.5"},
            {key: "test-e2e", value: Time.now.to_i.to_s}
          ]
        })

        puts "[Test] Mutation response: #{response["errors"] ? "ERROR" : "SUCCESS"}"

        if response["errors"]
          puts "[Test] Mutation errors: #{response["errors"].inspect}"
        else
          puts "[Test] Mutation completed, waiting for subscription data..."
        end

        # Mutationが成功していることを確認
        expect(response["errors"]).to be_nil
        expect(response["data"]["reportDataByNode"]).not_to be_nil
      end

      # Verify: Subscription通知を検証
      puts "\n[Test] Received #{received_data.length} subscription message(s)"

      expect(received_data).not_to be_empty,
        "Subscription should receive at least one data update"

      first_message = received_data.first
      expect(first_message).to have_key("onMessageInGroup")

      message_data = first_message["onMessageInGroup"]
      expect(message_data).not_to be_nil
      expect(message_data["groupId"]).to eq(group_id)
      expect(message_data["domain"]).to eq(domain)
      expect(message_data["nodeStatus"]).not_to be_nil

      subscription_data = message_data["nodeStatus"]
      # フィールドの検証
      expect(subscription_data["groupId"]).to eq(group_id),
        "Subscription data groupId should match"
      expect(subscription_data["domain"]).to eq(domain),
        "Subscription data domain should match"
      expect(subscription_data["nodeId"]).to eq(node_id),
        "Subscription data nodeId should match"
      expect(subscription_data["data"]).to be_an(Array)
      expect(subscription_data["data"].length).to eq(2)

      puts "\n✓ Subscription E2E test passed!"
      puts "  - groupId: #{subscription_data["groupId"]}"
      puts "  - domain: #{subscription_data["domain"]}"
      puts "  - nodeId: #{subscription_data["nodeId"]}"
      puts "  - data: #{subscription_data["data"].map { |d| "#{d["key"]}=#{d["value"]}" }.join(", ")}"
      puts "=" * 80
    end
  end

  describe "dissolveGroup mutation triggers onMessageInGroup subscription (GroupDissolvePayload)" do
    it "グループ解散時に購読者に通知が届く" do
      # Setup
      group = create_test_group("Dissolve E2E Test", host_id, domain)
      group_id = group["id"]
      join_test_node(group_id, domain, node_id)

      puts "\n[Test] Testing onMessageInGroup (GroupDissolvePayload) subscription..."

      subscription_query = <<~GRAPHQL
        subscription OnMessageInGroup($groupId: ID!, $domain: String!) {
          onMessageInGroup(groupId: $groupId, domain: $domain) {
            groupId
            domain
            groupDissolve {
              groupId
              domain
              message
            }
          }
        }
      GRAPHQL

      mutation_query = File.read(File.join(__dir__, "../fixtures/mutations/dissolve_group.graphql"))

      received_data = subscription_helper.subscribe_and_execute(
        subscription_query,
        {groupId: group_id, domain: domain},
        wait_time: 2,
        timeout: 15
      ) do
        puts "[Test] Dissolving group..."

        response = execute_graphql(mutation_query, {
          groupId: group_id,
          domain: domain,
          hostId: host_id
        })

        expect(response["errors"]).to be_nil
        puts "[Test] Group dissolved successfully"
      end

      # Verify
      expect(received_data).not_to be_empty
      message_data = received_data.first["onMessageInGroup"]
      expect(message_data).not_to be_nil
      expect(message_data["groupId"]).to eq(group_id)
      expect(message_data["domain"]).to eq(domain)
      expect(message_data["groupDissolve"]).not_to be_nil

      dissolve_data = message_data["groupDissolve"]
      expect(dissolve_data["groupId"]).to eq(group_id)
      expect(dissolve_data["domain"]).to eq(domain)
      expect(dissolve_data["message"]).to include("dissolved")

      puts "✓ Dissolve subscription test passed!"
    end
  end
end
