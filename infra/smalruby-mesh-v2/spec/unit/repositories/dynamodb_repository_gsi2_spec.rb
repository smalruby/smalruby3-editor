# frozen_string_literal: true

require "spec_helper"
require_relative "../../../lambda/repositories/dynamodb_repository"
require_relative "../../../lambda/domain/group"

RSpec.describe DynamoDBRepository do
  let(:dynamodb_client) { double("DynamoDBClient") }
  let(:table_name) { "TestTable" }
  let(:repository) { described_class.new(dynamodb_client, table_name) }

  describe "#save_group" do
    it "GSI2属性（gsi2_pk, gsi2_sk）を含めて保存する" do
      group = Group.new(
        id: "test-group-id",
        name: "abcdef1234567890abcdef1234567890",
        host_id: "abcdef1234567890abcdef1234567890",
        domain: "test.example.com",
        created_at: "2026-01-01T00:00:00Z"
      )

      expect(dynamodb_client).to receive(:put_item).with(
        hash_including(
          table_name: table_name,
          item: hash_including(
            "gsi2_pk" => "ALL_GROUPS",
            "gsi2_sk" => "abcdef1234567890abcdef1234567890"
          )
        )
      )

      repository.save_group(group)
    end

    it "GSI2のgsi2_skはグループ名（hostId）と一致する" do
      group_name = "fedcba9876543210fedcba9876543210"
      group = Group.new(
        id: "another-id",
        name: group_name,
        host_id: group_name,
        domain: "other.domain",
        created_at: "2026-01-01T00:00:00Z"
      )

      expect(dynamodb_client).to receive(:put_item).with(
        hash_including(
          item: hash_including(
            "gsi2_pk" => "ALL_GROUPS",
            "gsi2_sk" => group_name
          )
        )
      )

      repository.save_group(group)
    end
  end
end
