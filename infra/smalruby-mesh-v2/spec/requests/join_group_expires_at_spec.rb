require "spec_helper"
require "time"

RSpec.describe "joinGroup expiresAt validation", type: :request do
  let(:timestamp) { (Time.now.to_f * 1000).to_i }
  let(:domain) { "test-join-expires-at-#{timestamp}.example.com" }
  let(:host_id) { "host-#{timestamp}" }
  let(:node_id) { "node-#{timestamp}" }
  let(:group_name) { "Join Group expiresAt Test" }

  it "joinGroup mutation returns expiresAt" do
    # 1. グループを作成
    group = create_test_group(group_name, host_id, domain)
    group_id = group["id"]
    group_expires_at = group["expiresAt"]
    expect(group_id).not_to be_nil
    expect(group_expires_at).to match_iso8601

    # 2. グループに参加
    join_response = join_test_node(group_id, domain, node_id)

    # 3. expiresAtが返されることを確認
    expect(join_response["expiresAt"]).not_to be_nil
    expect(join_response["expiresAt"]).to match_iso8601

    # 4. グループのexpiresAtと一致することを確認
    # AWSDateTimeのフォーマットが微妙に異なる可能性（ミリ秒の有無など）を考慮し、
    # Timeオブジェクトに変換して比較する
    group_time = Time.parse(group_expires_at)
    join_time = Time.parse(join_response["expiresAt"])
    expect(join_time).to eq(group_time)
  end
end
