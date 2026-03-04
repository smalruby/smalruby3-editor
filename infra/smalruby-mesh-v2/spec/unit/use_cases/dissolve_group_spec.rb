require "spec_helper"
require_relative "../../../lambda/use_cases/dissolve_group"
require_relative "../../../lambda/domain/group"

RSpec.describe DissolveGroupUseCase do
  let(:repository) { double("Repository") }
  let(:use_case) { described_class.new(repository) }

  let(:group_id) { "test-group-123" }
  let(:domain) { "test.example.com" }
  let(:host_id) { "host-001" }
  let(:non_host_id) { "node-002" }

  let(:group) do
    Group.new(
      id: group_id,
      name: "Test Group",
      host_id: host_id,
      domain: domain,
      created_at: Time.now.utc.iso8601
    )
  end

  describe "#execute" do
    context "正常系" do
      it "ホストがグループを解散できる" do
        allow(repository).to receive(:find_group).with(group_id, domain).and_return(group)
        expect(repository).to receive(:dissolve_group).with(group_id, domain)

        result = use_case.execute(
          group_id: group_id,
          domain: domain,
          host_id: host_id
        )

        expect(result[:groupId]).to eq(group_id)
        expect(result[:domain]).to eq(domain)
        expect(result[:message]).to include("dissolved")
      end
    end

    context "異常系" do
      it "グループIDが空の場合エラー" do
        expect {
          use_case.execute(group_id: "", domain: domain, host_id: host_id)
        }.to raise_error(ArgumentError, /groupId is required/)
      end

      it "ドメインが空の場合エラー" do
        expect {
          use_case.execute(group_id: group_id, domain: "", host_id: host_id)
        }.to raise_error(ArgumentError, /domain is required/)
      end

      it "ホストIDが空の場合エラー" do
        expect {
          use_case.execute(group_id: group_id, domain: domain, host_id: "")
        }.to raise_error(ArgumentError, /hostId is required/)
      end

      it "グループが存在しない場合エラー" do
        allow(repository).to receive(:find_group).with(group_id, domain).and_return(nil)

        expect {
          use_case.execute(group_id: group_id, domain: domain, host_id: host_id)
        }.to raise_error(StandardError, /Group not found/)
      end

      it "ホストでないノードが解散を試みた場合エラー" do
        allow(repository).to receive(:find_group).with(group_id, domain).and_return(group)

        expect {
          use_case.execute(group_id: group_id, domain: domain, host_id: non_host_id)
        }.to raise_error(StandardError, /Only the host can dissolve the group/)
      end
    end

    context "べき等性" do
      it "既に解散されたグループを解散しようとした場合はエラー（グループ不存在）" do
        allow(repository).to receive(:find_group).with(group_id, domain).and_return(nil)

        expect {
          use_case.execute(group_id: group_id, domain: domain, host_id: host_id)
        }.to raise_error(StandardError, /Group not found/)
      end
    end
  end
end
