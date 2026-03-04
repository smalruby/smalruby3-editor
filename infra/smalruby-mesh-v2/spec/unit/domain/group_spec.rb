require "spec_helper"
require_relative "../../../lambda/domain/group"

RSpec.describe Group do
  describe "#initialize" do
    it "有効な属性でグループを作成できる" do
      group = Group.new(
        id: "group-001",
        name: "Test Group",
        host_id: "host-001",
        domain: "example.com",
        created_at: "2025-01-01T00:00:00Z",
        use_websocket: false,
        polling_interval_seconds: 2
      )

      expect(group.id).to eq("group-001")
      expect(group.name).to eq("Test Group")
      expect(group.host_id).to eq("host-001")
      expect(group.domain).to eq("example.com")
      expect(group.created_at).to eq("2025-01-01T00:00:00Z")
      expect(group.use_websocket).to eq(false)
      expect(group.polling_interval_seconds).to eq(2)
    end

    it "idがnilの場合はエラーを発生させる" do
      expect {
        Group.new(
          id: nil,
          name: "Test",
          host_id: "host-001",
          domain: "example.com",
          created_at: "2025-01-01T00:00:00Z"
        )
      }.to raise_error(ArgumentError, "id is required")
    end

    it "idが空文字の場合はエラーを発生させる" do
      expect {
        Group.new(
          id: "",
          name: "Test",
          host_id: "host-001",
          domain: "example.com",
          created_at: "2025-01-01T00:00:00Z"
        )
      }.to raise_error(ArgumentError, "id is required")
    end

    it "nameが空の場合はエラーを発生させる" do
      expect {
        Group.new(
          id: "group-001",
          name: "",
          host_id: "host-001",
          domain: "example.com",
          created_at: "2025-01-01T00:00:00Z"
        )
      }.to raise_error(ArgumentError, "name is required")
    end

    it "host_idがnilの場合はエラーを発生させる" do
      expect {
        Group.new(
          id: "group-001",
          name: "Test",
          host_id: nil,
          domain: "example.com",
          created_at: "2025-01-01T00:00:00Z"
        )
      }.to raise_error(ArgumentError, "host_id is required")
    end

    it "domainが空の場合はエラーを発生させる" do
      expect {
        Group.new(
          id: "group-001",
          name: "Test",
          host_id: "host-001",
          domain: "",
          created_at: "2025-01-01T00:00:00Z"
        )
      }.to raise_error(ArgumentError, "domain is required")
    end

    it "domainが256文字を超える場合はエラーを発生させる" do
      expect {
        Group.new(
          id: "group-001",
          name: "Test",
          host_id: "host-001",
          domain: "a" * 257,
          created_at: "2025-01-01T00:00:00Z"
        )
      }.to raise_error(ArgumentError, "domain must be 256 characters or less")
    end

    it "created_atが空の場合はエラーを発生させる" do
      expect {
        Group.new(
          id: "group-001",
          name: "Test",
          host_id: "host-001",
          domain: "example.com",
          created_at: ""
        )
      }.to raise_error(ArgumentError, "created_at is required")
    end
  end

  describe "#full_id" do
    it "id@domain形式のfullIdを返す" do
      group = Group.new(
        id: "group-001",
        name: "Test",
        host_id: "host-001",
        domain: "example.com",
        created_at: "2025-01-01T00:00:00Z"
      )

      expect(group.full_id).to eq("group-001@example.com")
    end
  end
end
