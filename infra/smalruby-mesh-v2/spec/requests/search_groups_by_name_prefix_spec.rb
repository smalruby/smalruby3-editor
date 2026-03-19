require "spec_helper"

RSpec.describe "searchGroupsByNamePrefix Query", type: :request do
  let(:search_query) { File.read(File.join(__dir__, "../fixtures/queries/search_groups_by_name_prefix.graphql")) }
  let(:timestamp) { Time.now.to_i }

  describe "基本的な検索" do
    it "名前プレフィックスでグループを検索できる" do
      # グループ作成
      host_id = "abcdef#{timestamp}aaaaaaaaaaaaaaaaaa"
      group = create_test_group(host_id, host_id, "domain-search-#{timestamp}")

      # プレフィックスで検索
      response = execute_graphql(search_query, {namePrefix: "abcdef"})

      expect(response["errors"]).to be_nil
      groups = response["data"]["searchGroupsByNamePrefix"]
      expect(groups).to be_an(Array)

      matching = groups.find { |g| g["id"] == group["id"] }
      expect(matching).not_to be_nil
      expect(matching["domain"]).to eq("domain-search-#{timestamp}")
      expect(matching["name"]).to eq(host_id)
    end

    it "異なるドメインのグループを横断検索できる" do
      prefix = "fedcba"
      host_a = "#{prefix}#{timestamp}bbbbbbbbbbbbbbbbbb"
      host_b = "#{prefix}#{timestamp}cccccccccccccccccc"

      group_a = create_test_group(host_a, host_a, "domain-a-#{timestamp}")
      group_b = create_test_group(host_b, host_b, "domain-b-#{timestamp}")

      response = execute_graphql(search_query, {namePrefix: prefix})

      expect(response["errors"]).to be_nil
      groups = response["data"]["searchGroupsByNamePrefix"]
      ids = groups.map { |g| g["id"] }

      expect(ids).to include(group_a["id"])
      expect(ids).to include(group_b["id"])
    end

    it "プレフィックスが一致しないグループは返さない" do
      host_id = "111111#{timestamp}dddddddddddddddddd"
      create_test_group(host_id, host_id, "domain-nomatch-#{timestamp}")

      response = execute_graphql(search_query, {namePrefix: "222222"})

      expect(response["errors"]).to be_nil
      groups = response["data"]["searchGroupsByNamePrefix"]
      matching = groups.find { |g| g["name"].start_with?("111111") }
      expect(matching).to be_nil
    end
  end

  describe "プレフィックスの長さ" do
    it "1文字のプレフィックスで検索できる" do
      host_id = "a#{timestamp}00000000000000000000000"
      create_test_group(host_id, host_id, "domain-short-#{timestamp}")

      response = execute_graphql(search_query, {namePrefix: "a"})

      expect(response["errors"]).to be_nil
      expect(response["data"]["searchGroupsByNamePrefix"]).to be_an(Array)
    end

    it "6文字のプレフィックスで検索できる" do
      host_id = "abcdef#{timestamp}eeeeeeeeeeeeeeeeee"
      group = create_test_group(host_id, host_id, "domain-exact-#{timestamp}")

      response = execute_graphql(search_query, {namePrefix: "abcdef"})

      expect(response["errors"]).to be_nil
      groups = response["data"]["searchGroupsByNamePrefix"]
      matching = groups.find { |g| g["id"] == group["id"] }
      expect(matching).not_to be_nil
    end

    it "7文字以上のプレフィックスはエラーになる" do
      response = execute_graphql(search_query, {namePrefix: "abcdefg"}, suppress_errors: true)

      expect(response["errors"]).not_to be_nil
    end

    it "空のプレフィックスはエラーになる" do
      response = execute_graphql(search_query, {namePrefix: ""}, suppress_errors: true)

      expect(response["errors"]).not_to be_nil
    end
  end

  describe "レスポンスの形式" do
    it "必要なフィールドがすべて返される" do
      host_id = "aabbcc#{timestamp}ffffffffffffffffffff"
      create_test_group(host_id, host_id, "domain-fields-#{timestamp}")

      response = execute_graphql(search_query, {namePrefix: "aabbcc"})

      expect(response["errors"]).to be_nil
      groups = response["data"]["searchGroupsByNamePrefix"]
      group = groups.find { |g| g["name"] == host_id }
      expect(group).not_to be_nil

      expect(group["id"]).to be_present
      expect(group["domain"]).to eq("domain-fields-#{timestamp}")
      expect(group["fullId"]).to include("@domain-fields-#{timestamp}")
      expect(group["name"]).to eq(host_id)
      expect(group["hostId"]).to eq(host_id)
      expect(group["expiresAt"]).to match_iso8601
    end
  end
end
