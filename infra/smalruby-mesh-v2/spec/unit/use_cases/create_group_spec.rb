require "spec_helper"
require_relative "../../../lambda/use_cases/create_group"
require_relative "../../../lambda/domain/group"

RSpec.describe CreateGroupUseCase do
  let(:repository) { double("Repository") }
  let(:use_case) { described_class.new(repository) }

  describe "#execute" do
    context "既存グループが存在しない場合" do
      it "新しいグループを作成する" do
        allow(repository).to receive(:find_group_by_host_and_domain)
          .with("host-001", "example.com")
          .and_return(nil)

        expect(repository).to receive(:save_group) do |group|
          expect(group).to be_a(Group)
          expect(group.name).to eq("Test Group")
          expect(group.host_id).to eq("host-001")
          expect(group.domain).to eq("example.com")
          expect(group.id).to be_present
          expect(group.created_at).to match_iso8601
          expect(group.use_websocket).to eq(true)
          expect(group.polling_interval_seconds).to be_nil
        end

        result = use_case.execute(
          name: "Test Group",
          host_id: "host-001",
          domain: "example.com"
        )

        expect(result).to be_a(Group)
        expect(result.name).to eq("Test Group")
        expect(result.host_id).to eq("host-001")
        expect(result.domain).to eq("example.com")
      end

      it "use_websocket: false の場合、ポーリング間隔が設定される" do
        allow(repository).to receive(:find_group_by_host_and_domain).and_return(nil)
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with("MESH_POLLING_INTERVAL_SECONDS").and_return("5")

        expect(repository).to receive(:save_group) do |group|
          expect(group.use_websocket).to eq(false)
          expect(group.polling_interval_seconds).to eq(5)
        end

        use_case.execute(
          name: "Polling Group",
          host_id: "host-001",
          domain: "example.com",
          use_websocket: false
        )
      end

      it "グループIDが自動生成される" do
        allow(repository).to receive(:find_group_by_host_and_domain)
          .and_return(nil)
        allow(repository).to receive(:save_group)

        result1 = use_case.execute(
          name: "Group 1",
          host_id: "host-001",
          domain: "example.com"
        )

        result2 = use_case.execute(
          name: "Group 2",
          host_id: "host-002",
          domain: "example.com"
        )

        # 異なるグループIDが生成される
        expect(result1.id).not_to eq(result2.id)
      end
    end

    context "既存グループが存在する場合" do
      it "既存グループを返す（冪等性）" do
        existing_group = Group.new(
          id: "existing-id",
          name: "Existing Group",
          host_id: "host-001",
          domain: "example.com",
          created_at: Time.now.utc.iso8601
        )

        allow(repository).to receive(:find_group_by_host_and_domain)
          .with("host-001", "example.com")
          .and_return(existing_group)

        # save_groupは呼ばれないことを確認
        expect(repository).not_to receive(:save_group)

        result = use_case.execute(
          name: "New Group Name",
          host_id: "host-001",
          domain: "example.com"
        )

        # 既存グループが返される
        expect(result).to eq(existing_group)
        expect(result.id).to eq("existing-id")
        expect(result.name).to eq("Existing Group")
      end

      it "同じhostId + domainで複数回呼び出しても同じグループを返す" do
        existing_group = Group.new(
          id: "stable-id",
          name: "Stable Group",
          host_id: "host-stable",
          domain: "stable.example.com",
          created_at: "2025-01-01T00:00:00Z"
        )

        allow(repository).to receive(:find_group_by_host_and_domain)
          .with("host-stable", "stable.example.com")
          .and_return(existing_group)

        result1 = use_case.execute(
          name: "Attempt 1",
          host_id: "host-stable",
          domain: "stable.example.com"
        )

        result2 = use_case.execute(
          name: "Attempt 2",
          host_id: "host-stable",
          domain: "stable.example.com"
        )

        result3 = use_case.execute(
          name: "Attempt 3",
          host_id: "host-stable",
          domain: "stable.example.com"
        )

        # すべて同じグループIDを返す
        expect(result1.id).to eq("stable-id")
        expect(result2.id).to eq("stable-id")
        expect(result3.id).to eq("stable-id")
      end
    end
  end
end
