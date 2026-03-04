require "spec_helper"

RSpec.describe "Group Management API", type: :request do
  let(:api_endpoint) { ENV["APPSYNC_ENDPOINT"] }
  let(:api_key) { ENV["APPSYNC_API_KEY"] }

  describe "createGroup mutation" do
    it "新しいグループを作成できる" do
      query = File.read(File.join(__dir__, "../fixtures/mutations/create_group.graphql"))
      variables = {
        name: "Test Group",
        hostId: "host-#{Time.now.to_i}-001",
        domain: "test.example.com",
        useWebSocket: true
      }

      response = execute_graphql(query, variables)

      expect(response["errors"]).to be_nil
      expect(response["data"]["createGroup"]).to include(
        "domain" => "test.example.com",
        "name" => "Test Group"
      )
      expect(response["data"]["createGroup"]["hostId"]).to eq(variables[:hostId])
      expect(response["data"]["createGroup"]["id"]).to be_present
      expect(response["data"]["createGroup"]["fullId"]).to match(/\A.+@test\.example\.com\z/)
    end

    it "同じhostId + domainで2回呼び出すと既存グループを返す（冪等性）" do
      query = File.read(File.join(__dir__, "../fixtures/mutations/create_group.graphql"))
      host_id = "host-#{Time.now.to_i}-002"
      variables = {
        name: "Test Group",
        hostId: host_id,
        domain: "test.example.com",
        useWebSocket: true
      }

      # 1回目
      response1 = execute_graphql(query, variables)
      expect(response1["errors"]).to be_nil
      group_id_1 = response1["data"]["createGroup"]["id"]

      # 2回目（同じhostId + domain）
      response2 = execute_graphql(query, variables)
      expect(response2["errors"]).to be_nil
      group_id_2 = response2["data"]["createGroup"]["id"]

      # 同じグループIDが返される
      expect(group_id_1).to eq(group_id_2)
    end

    it "異なるhostIdで新しいグループを作成できる" do
      query = File.read(File.join(__dir__, "../fixtures/mutations/create_group.graphql"))
      timestamp = Time.now.to_i

      # 1回目
      variables1 = {
        name: "Group A",
        hostId: "host-#{timestamp}-003",
        domain: "test.example.com",
        useWebSocket: true
      }
      response1 = execute_graphql(query, variables1)
      expect(response1["errors"]).to be_nil
      group_id_1 = response1["data"]["createGroup"]["id"]

      # 2回目（異なるhostId）
      variables2 = {
        name: "Group B",
        hostId: "host-#{timestamp}-004",
        domain: "test.example.com",
        useWebSocket: true
      }
      response2 = execute_graphql(query, variables2)
      expect(response2["errors"]).to be_nil
      group_id_2 = response2["data"]["createGroup"]["id"]

      # 異なるグループIDが返される
      expect(group_id_1).not_to eq(group_id_2)
    end
  end

  describe "listGroupsByDomain query" do
    it "ドメイン内のグループ一覧を取得できる" do
      timestamp = Time.now.to_i
      test_domain = "test-#{timestamp}.example.com"

      # テストデータ作成
      create_test_group("Group A", "host-#{timestamp}-005", test_domain)
      create_test_group("Group B", "host-#{timestamp}-006", test_domain)

      query = File.read(File.join(__dir__, "../fixtures/queries/list_groups_by_domain.graphql"))
      variables = {domain: test_domain}

      response = execute_graphql(query, variables)

      expect(response["errors"]).to be_nil
      expect(response["data"]["listGroupsByDomain"]).to be_an(Array)
      expect(response["data"]["listGroupsByDomain"].size).to be >= 2

      # すべてのグループが同じドメインを持つ
      response["data"]["listGroupsByDomain"].each do |group|
        expect(group["domain"]).to eq(test_domain)
        expect(group["id"]).to be_present
        expect(group["fullId"]).to match(/\A.+@#{Regexp.escape(test_domain)}\z/)
      end
    end

    it "存在しないドメインの場合は空配列を返す" do
      query = File.read(File.join(__dir__, "../fixtures/queries/list_groups_by_domain.graphql"))
      variables = {domain: "nonexistent-#{Time.now.to_i}.example.com"}

      response = execute_graphql(query, variables)

      expect(response["errors"]).to be_nil
      expect(response["data"]["listGroupsByDomain"]).to eq([])
    end
  end
end
