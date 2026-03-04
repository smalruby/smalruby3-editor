require "spec_helper"

RSpec.describe "DissolveGroup with Multibyte Data", type: :request do
  let(:domain) { "test-multibyte-#{Time.now.to_i}.example.com" }
  let(:host_id) { "host-multibyte-#{Time.now.to_i}" }
  let(:node_id) { "node-multibyte-#{Time.now.to_i}" }
  let(:group_name) { "Multibyte Test Group" }

  it "日本語のデータキーを持つグループを解散できる" do
    # 1. グループ作成
    group = create_test_group(group_name, host_id, domain)
    group_id = group["id"]

    # 2. ノード参加
    join_test_node(group_id, domain, node_id)

    # 3. 日本語キーでデータ報告（本番環境と同じデータ形式）
    report_query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
    execute_graphql(report_query, {
      groupId: group_id,
      domain: domain,
      nodeId: node_id,
      data: [
        {key: "ホストグローバル", value: "13"}, # 日本語キー
        {key: "温度", value: "25.5"}, # 日本語キー
        {key: "カウンター", value: "42"} # 日本語キー
      ]
    })

    # 4. グループ解散（ここでエンコーディングエラーが発生する可能性）
    dissolve_query = File.read(File.join(__dir__, "../fixtures/mutations/dissolve_group.graphql"))
    response = execute_graphql(dissolve_query, {
      groupId: group_id,
      domain: domain,
      hostId: host_id
    })

    # 5. エラーなく成功することを確認
    expect(response["errors"]).to be_nil
    expect(response["data"]["dissolveGroup"]).not_to be_nil
    # Verify top-level filtering fields
    expect(response["data"]["dissolveGroup"]["groupId"]).to eq(group_id)
    expect(response["data"]["dissolveGroup"]["domain"]).to eq(domain)

    expect(response["data"]["dissolveGroup"]["groupDissolve"]["groupId"]).to eq(group_id)

    # 6. グループが削除されていることを確認
    list_query = File.read(File.join(__dir__, "../fixtures/queries/list_groups_by_domain.graphql"))
    list_response = execute_graphql(list_query, {
      domain: domain
    })
    expect(list_response["data"]["listGroupsByDomain"].any? { |g| g["id"] == group_id }).to be_falsey
  end

  it "様々なマルチバイト文字（絵文字、中国語、韓国語）でもグループを解散できる" do
    group = create_test_group(group_name, host_id, domain)
    group_id = group["id"]
    join_test_node(group_id, domain, node_id)

    # 多様なマルチバイト文字でテスト
    report_query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
    execute_graphql(report_query, {
      groupId: group_id,
      domain: domain,
      nodeId: node_id,
      data: [
        {key: "🎮ゲームスコア", value: "9999"}, # 絵文字 + 日本語
        {key: "玩家名称", value: "张三"}, # 中国語
        {key: "플레이어이름", value: "김철수"} # 韓国語
      ]
    })

    dissolve_query = File.read(File.join(__dir__, "../fixtures/mutations/dissolve_group.graphql"))
    response = execute_graphql(dissolve_query, {
      groupId: group_id,
      domain: domain,
      hostId: host_id
    })

    expect(response["errors"]).to be_nil
    expect(response["data"]["dissolveGroup"]).not_to be_nil
    # Verify top-level filtering fields
    expect(response["data"]["dissolveGroup"]["groupId"]).to eq(group_id)
    expect(response["data"]["dissolveGroup"]["domain"]).to eq(domain)

    expect(response["data"]["dissolveGroup"]["groupDissolve"]["groupId"]).to eq(group_id)
  end
end
