require "spec_helper"
require_relative "../../../lambda/use_cases/leave_group"

RSpec.describe LeaveGroupUseCase do
  let(:repository) { double("Repository") }
  let(:use_case) { described_class.new(repository) }

  describe "#execute" do
    let(:group_id) { "test-group-123" }
    let(:domain) { "example.com" }
    let(:peer_id) { "peer-001" }

    context "ピアがグループから正常に退出する場合" do
      it "ピアをグループから削除し、データも削除する" do
        # ピアの削除を期待
        expect(repository).to receive(:remove_node_from_group)
          .with(group_id, domain, peer_id)
          .and_return(true)

        # ピアのデータ削除を期待
        expect(repository).to receive(:delete_peer_data)
          .with(group_id, domain, peer_id)
          .and_return(true)

        result = use_case.execute(
          group_id: group_id,
          domain: domain,
          peer_id: peer_id
        )

        expect(result[:success]).to be true
        expect(result[:peer_id]).to eq(peer_id)
        expect(result[:group_id]).to eq(group_id)
        expect(result[:domain]).to eq(domain)
      end

      it "成功メッセージを返す" do
        allow(repository).to receive(:remove_node_from_group).and_return(true)
        allow(repository).to receive(:delete_peer_data).and_return(true)

        result = use_case.execute(
          group_id: group_id,
          domain: domain,
          peer_id: peer_id
        )

        expect(result[:message]).to include("successfully left")
      end
    end

    context "ピアの削除に失敗した場合" do
      it "失敗の結果を返す" do
        allow(repository).to receive(:remove_node_from_group)
          .and_return(false)
        allow(repository).to receive(:delete_peer_data)
          .and_return(true)

        result = use_case.execute(
          group_id: group_id,
          domain: domain,
          peer_id: peer_id
        )

        expect(result[:success]).to be false
        expect(result[:error]).to include("Failed to remove peer")
      end
    end

    context "ピアのデータ削除に失敗した場合" do
      it "失敗の結果を返す" do
        allow(repository).to receive(:remove_node_from_group)
          .and_return(true)
        allow(repository).to receive(:delete_peer_data)
          .and_return(false)

        result = use_case.execute(
          group_id: group_id,
          domain: domain,
          peer_id: peer_id
        )

        expect(result[:success]).to be false
        expect(result[:error]).to include("Failed to delete peer data")
      end
    end

    context "複数のピアが連続して退出する場合" do
      it "各ピアを独立して処理する" do
        peer_ids = ["peer-001", "peer-002", "peer-003"]

        peer_ids.each do |pid|
          expect(repository).to receive(:remove_node_from_group)
            .with(group_id, domain, pid)
            .and_return(true)
          expect(repository).to receive(:delete_peer_data)
            .with(group_id, domain, pid)
            .and_return(true)

          result = use_case.execute(
            group_id: group_id,
            domain: domain,
            peer_id: pid
          )

          expect(result[:success]).to be true
          expect(result[:peer_id]).to eq(pid)
        end
      end
    end
  end
end
