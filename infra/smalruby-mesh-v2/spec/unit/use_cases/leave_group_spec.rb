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

    # issue #1267: 入力上限
    context "入力の検査" do
      it "出席番号付きのノード ID（…s07）は通す" do
        pid = "0123456789abcdef0123456789abcdefs07"
        allow(repository).to receive(:remove_node_from_group).and_return(true)
        allow(repository).to receive(:delete_peer_data).and_return(true)
        result = use_case.execute(group_id: group_id, domain: domain, peer_id: pid)
        expect(result[:success]).to be true
      end

      it "長すぎる・使えない文字の nodeId は ValidationError（DB に触らない）" do
        expect(repository).not_to receive(:remove_node_from_group)
        expect {
          use_case.execute(group_id: group_id, domain: domain, peer_id: "a" * 129)
        }.to raise_error(MeshInput::ValidationError, /nodeId/)
        expect {
          use_case.execute(group_id: group_id, domain: domain, peer_id: "node#1")
        }.to raise_error(MeshInput::ValidationError, /nodeId/)
      end
    end
  end
end
