require "spec_helper"

RSpec.describe "LeaveGroup with Multibyte Data", type: :request do
  let(:domain) { "test-leave-multibyte-#{Time.now.to_i}.example.com" }
  let(:host_id) { "host-#{Time.now.to_i}" }
  let(:node_id) { "node-#{Time.now.to_i}" }
  let(:group_name) { "Leave Multibyte Test Group" }

  it "日本語のデータキーを持つノードがグループから退出でき、データも削除される" do
    # 1. グループ作成
    group = create_test_group(group_name, host_id, domain)
    group_id = group["id"]

    # 2. ノード参加
    join_test_node(group_id, domain, node_id)

    # 3. 日本語キーでデータ報告
    report_query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
    execute_graphql(report_query, {
      groupId: group_id,
      domain: domain,
      nodeId: node_id,
      data: [
        {key: "ホストグローバル", value: "4"}, # 本番環境で実際に使用されたキー
        {key: "メンバーローカル", value: "8"}
      ]
    })

    # 4. データが存在することを確認
    list_query = File.read(File.join(__dir__, "../fixtures/queries/list_group_statuses.graphql"))
    list_res_before = execute_graphql(list_query, {
      groupId: group_id,
      domain: domain
    })
    expect(list_res_before["data"]["listGroupStatuses"].any? { |s| s["nodeId"] == node_id }).to be true

    # 5. グループから退出（ここでエンコーディングエラーが発生する可能性）
    leave_query = File.read(File.join(__dir__, "../fixtures/mutations/leave_group.graphql"))
    leave_res = execute_graphql(leave_query, {
      groupId: group_id,
      nodeId: node_id,
      domain: domain
    })

    # 6. エラーなく成功することを確認
    expect(leave_res["errors"]).to be_nil
    expect(leave_res["data"]["leaveGroup"]).to include(
      "peerId" => node_id,
      "groupId" => group_id,
      "domain" => domain
    )

    # 7. データが削除されていることを確認
    list_res_after = execute_graphql(list_query, {
      groupId: group_id,
      domain: domain
    })
    expect(list_res_after["data"]["listGroupStatuses"].any? { |s| s["nodeId"] == node_id }).to be false
  end
end
