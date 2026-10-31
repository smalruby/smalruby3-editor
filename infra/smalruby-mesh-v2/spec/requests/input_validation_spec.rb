require "spec_helper"

# issue #1267: name / hostId / nodeId の長さと文字の上限
#
# - ID（hostId / nodeId）: 1〜128 文字、A-Z a-z 0-9 _ - のみ
# - グループ名（name）: 1〜1024 文字、制御文字（U+0000〜U+001F, U+007F）なし
#
# JS リゾルバ（createGroup / joinGroup / renewHeartbeat / sendMemberHeartbeat / reportDataByNode /
# fireEventsByNode）は errorType = "ValidationError"。Ruby Lambda（leaveGroup / dissolveGroup /
# recordEventsByNode）は例外クラス MeshInput::ValidationError が errorType に入る。
RSpec.describe "Mesh input validation", type: :request do
  let(:timestamp) { "#{Time.now.to_i}#{SecureRandom.hex(2)}" }
  let(:domain) { "test-input-#{timestamp}.example.com" }
  # 今のクライアントの形式: 32 桁 16 進（+ 出席番号の末尾 s07）
  let(:host_id) { SecureRandom.hex(16) }
  let(:node_id) { "#{SecureRandom.hex(16)}s07" }
  let(:too_long_id) { "a" * 129 }
  let(:bad_char_id) { "node#NODE#x" }

  def fixture(name)
    File.read(File.join(__dir__, "../fixtures/mutations/#{name}.graphql"))
  end

  def expect_validation_error(response)
    expect(response["errors"]).not_to be_nil
    expect(response["errors"][0]["errorType"]).to match(/ValidationError/)
  end

  let(:events) { [{eventName: "evt", payload: "1", firedAt: "2026-10-30T00:00:00.000Z"}] }

  let(:fire_events_query) do
    <<~GRAPHQL
      mutation FireEventsByNode($groupId: ID!, $domain: String!, $nodeId: ID!, $events: [EventInput!]!) {
        fireEventsByNode(groupId: $groupId, domain: $domain, nodeId: $nodeId, events: $events) {
          groupId
          domain
        }
      }
    GRAPHQL
  end

  describe "今のクライアントの形式は通る" do
    it "32 桁 16 進の hostId と出席番号付きの名前でグループを作り、…s07 のノードが参加・送信・退出できる" do
      group = create_test_group("#{host_id}|seats=3,7,12|host=3", host_id, domain)
      expect(group).not_to be_nil
      expect(group["name"]).to eq("#{host_id}|seats=3,7,12|host=3")

      join_test_node(group["id"], domain, node_id)

      args = {groupId: group["id"], domain: domain, nodeId: node_id}
      expect(execute_graphql(fixture("send_member_heartbeat"), args)["errors"]).to be_nil
      expect(execute_graphql(fixture("report_data_by_node"), args.merge(data: [{key: "k", value: "v"}]))["errors"]).to be_nil
      expect(execute_graphql(fire_events_query, args.merge(events: events))["errors"]).to be_nil
      expect(execute_graphql(fixture("renew_heartbeat"), {groupId: group["id"], domain: domain, hostId: host_id})["errors"]).to be_nil
      expect(execute_graphql(fixture("leave_group"), args)["errors"]).to be_nil
      expect(execute_graphql(fixture("dissolve_group"), {groupId: group["id"], domain: domain, hostId: host_id})["errors"]).to be_nil
    end

    it "クラス外の名前（hostId だけ）・host=teacher の名前でグループを作れる" do
      expect(create_test_group(host_id, host_id, domain)).not_to be_nil
      other_host = SecureRandom.hex(16)
      expect(create_test_group("#{other_host}|host=teacher", other_host, "teacher-#{domain}")).not_to be_nil
    end
  end

  describe "createGroup" do
    it "長すぎる hostId は ValidationError" do
      response = execute_graphql(fixture("create_group"), {name: "g", hostId: too_long_id, domain: domain, useWebSocket: true}, suppress_errors: true)
      expect_validation_error(response)
    end

    it "使えない文字の hostId は ValidationError" do
      response = execute_graphql(fixture("create_group"), {name: "g", hostId: bad_char_id, domain: domain, useWebSocket: true}, suppress_errors: true)
      expect_validation_error(response)
    end

    it "長すぎる名前は ValidationError" do
      response = execute_graphql(fixture("create_group"), {name: "a" * 1025, hostId: host_id, domain: domain, useWebSocket: true}, suppress_errors: true)
      expect_validation_error(response)
    end

    it "制御文字入りの名前は ValidationError" do
      response = execute_graphql(fixture("create_group"), {name: "bad\nname", hostId: host_id, domain: domain, useWebSocket: true}, suppress_errors: true)
      expect_validation_error(response)
    end
  end

  describe "グループに対する mutation" do
    let!(:group) { create_test_group(host_id, host_id, domain) }
    let(:group_args) { {groupId: group["id"], domain: domain} }

    %i[too_long_id bad_char_id].each do |bad|
      context "nodeId / hostId が #{bad}" do
        let(:bad_id) { send(bad) }

        it "joinGroup は ValidationError" do
          expect_validation_error(execute_graphql(fixture("join_group"), group_args.merge(nodeId: bad_id), suppress_errors: true))
        end

        it "sendMemberHeartbeat は ValidationError" do
          expect_validation_error(execute_graphql(fixture("send_member_heartbeat"), group_args.merge(nodeId: bad_id), suppress_errors: true))
        end

        it "reportDataByNode は ValidationError" do
          response = execute_graphql(fixture("report_data_by_node"), group_args.merge(nodeId: bad_id, data: [{key: "k", value: "v"}]), suppress_errors: true)
          expect_validation_error(response)
        end

        it "fireEventsByNode は ValidationError" do
          response = execute_graphql(fire_events_query, group_args.merge(nodeId: bad_id, events: events), suppress_errors: true)
          expect_validation_error(response)
        end

        it "recordEventsByNode は ValidationError" do
          response = execute_graphql(fixture("record_events_by_node"), group_args.merge(nodeId: bad_id, events: events), suppress_errors: true)
          expect_validation_error(response)
        end

        it "leaveGroup は ValidationError" do
          expect_validation_error(execute_graphql(fixture("leave_group"), group_args.merge(nodeId: bad_id), suppress_errors: true))
        end

        it "renewHeartbeat は ValidationError" do
          expect_validation_error(execute_graphql(fixture("renew_heartbeat"), group_args.merge(hostId: bad_id), suppress_errors: true))
        end

        it "dissolveGroup は ValidationError（グループは残る）" do
          expect_validation_error(execute_graphql(fixture("dissolve_group"), group_args.merge(hostId: bad_id), suppress_errors: true))
          expect(execute_graphql(fixture("renew_heartbeat"), group_args.merge(hostId: host_id))["errors"]).to be_nil
        end
      end
    end
  end
end
