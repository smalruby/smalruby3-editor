# frozen_string_literal: true

require "spec_helper"
require_relative "../../../lambda/repositories/dynamodb_repository"
require_relative "../../../lambda/domain/group"

RSpec.describe DynamoDBRepository do
  let(:dynamodb_client) { double("DynamoDBClient") }
  let(:table_name) { "TestTable" }
  let(:repository) { described_class.new(dynamodb_client, table_name) }

  let(:domain) { "テスト.example.com" }
  let(:group_id) { "グループ123" }
  let(:host_id) { "ホスト001" }

  describe "#dissolve_group" do
    it "handles items with multibyte characters correctly" do
      # Mock query response with multibyte characters
      mock_items = [
        {
          "pk" => "DOMAIN##{domain}",
          "sk" => "GROUP##{group_id}#METADATA",
          "id" => group_id,
          "name" => "テストグループ"
        },
        {
          "pk" => "DOMAIN##{domain}",
          "sk" => "GROUP##{group_id}#NODE#ノード001#STATUS",
          "nodeId" => "ノード001",
          "data" => [{"key" => "ホストグローバル", "value" => "13"}]
        }
      ]
      mock_result = double("QueryResult", items: mock_items)

      expect(dynamodb_client).to receive(:query).and_return(mock_result)

      # Expect delete_item for each item and each node metadata
      expect(dynamodb_client).to receive(:delete_item).exactly(3).times

      result = repository.dissolve_group(group_id, domain)
      expect(result).to be true
    end
  end

  describe "#find_group" do
    it "handles multibyte characters in keys and attributes" do
      mock_item = {
        "id" => group_id,
        "name" => "テストグループ",
        "hostId" => host_id,
        "domain" => domain,
        "createdAt" => Time.now.utc.iso8601
      }
      mock_result = double("GetItemResult", item: mock_item)

      expect(dynamodb_client).to receive(:get_item).with(
        table_name: table_name,
        key: {
          "pk" => "DOMAIN##{domain}",
          "sk" => "GROUP##{group_id}#METADATA"
        }
      ).and_return(mock_result)

      group = repository.find_group(group_id, domain)

      expect(group.id).to eq(group_id)
      expect(group.name).to eq("テストグループ")
      expect(group.domain).to eq(domain)
    end
  end
end
