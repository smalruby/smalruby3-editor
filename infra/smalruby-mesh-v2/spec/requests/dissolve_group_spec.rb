require "spec_helper"

RSpec.describe "DissolveGroup API", type: :request do
  let(:domain) { "test-dissolve-#{Time.now.to_i}.example.com" }
  let(:host_id) { "host-dissolve-#{Time.now.to_i}" }
  let(:node_id) { "node-dissolve-#{Time.now.to_i}" }
  let(:group_name) { "Test Dissolve Group" }

  describe "dissolveGroup mutation" do
    context "正常系" do
      it "ホストがグループを解散できる" do
        # グループを作成
        group = create_test_group(group_name, host_id, domain)
        group_id = group["id"]

        # グループ解散
        query = File.read(File.join(__dir__, "../fixtures/mutations/dissolve_group.graphql"))
        response = execute_graphql(query, {
          groupId: group_id,
          domain: domain,
          hostId: host_id
        })

        # レスポンス検証
        expect(response["errors"]).to be_nil
        expect(response["data"]["dissolveGroup"]).not_to be_nil
        # Verify top-level filtering fields
        expect(response["data"]["dissolveGroup"]["groupId"]).to eq(group_id)
        expect(response["data"]["dissolveGroup"]["domain"]).to eq(domain)

        expect(response["data"]["dissolveGroup"]["groupDissolve"]).not_to be_nil
        expect(response["data"]["dissolveGroup"]["groupDissolve"]["groupId"]).to eq(group_id)
        expect(response["data"]["dissolveGroup"]["groupDissolve"]["domain"]).to eq(domain)
        expect(response["data"]["dissolveGroup"]["groupDissolve"]["message"]).to include("dissolved")

        # グループが存在しないことを確認
        list_query = File.read(File.join(__dir__, "../fixtures/queries/list_groups_by_domain.graphql"))
        list_response = execute_graphql(list_query, {
          domain: domain
        })

        expect(list_response["data"]["listGroupsByDomain"].any? { |g| g["id"] == group_id }).to be_falsey
      end

      it "メンバーがいるグループでもホストが解散できる" do
        # グループを作成
        group = create_test_group(group_name, host_id, domain)
        group_id = group["id"]

        # ノードを参加させる
        join_test_node(group_id, domain, node_id)

        # グループ解散
        query = File.read(File.join(__dir__, "../fixtures/mutations/dissolve_group.graphql"))
        response = execute_graphql(query, {
          groupId: group_id,
          domain: domain,
          hostId: host_id
        })

        # レスポンス検証
        expect(response["errors"]).to be_nil
        expect(response["data"]["dissolveGroup"]).not_to be_nil
        # Verify top-level filtering fields
        expect(response["data"]["dissolveGroup"]["groupId"]).to eq(group_id)
        expect(response["data"]["dissolveGroup"]["domain"]).to eq(domain)

        expect(response["data"]["dissolveGroup"]["groupDissolve"]["groupId"]).to eq(group_id)

        # グループが存在しないことを確認
        list_query = File.read(File.join(__dir__, "../fixtures/queries/list_groups_by_domain.graphql"))
        list_response = execute_graphql(list_query, {
          domain: domain
        })

        expect(list_response["data"]["listGroupsByDomain"].any? { |g| g["id"] == group_id }).to be_falsey
      end
    end

    context "異常系" do
      it "ホストでないノードが解散を試みるとエラー" do
        # グループを作成
        group = create_test_group(group_name, host_id, domain)
        group_id = group["id"]

        # ノードを参加させる
        join_test_node(group_id, domain, node_id)

        # 非ホストが解散を試みる
        query = File.read(File.join(__dir__, "../fixtures/mutations/dissolve_group.graphql"))
        response = execute_graphql(query, {
          groupId: group_id,
          domain: domain,
          hostId: node_id  # ホストではない
        }, suppress_errors: true)

        # エラーレスポンス検証
        expect(response["errors"]).not_to be_nil
        expect(response["errors"][0]["message"]).to include("Only the host can dissolve")
      end

      it "存在しないグループを解散しようとするとエラー" do
        query = File.read(File.join(__dir__, "../fixtures/mutations/dissolve_group.graphql"))
        response = execute_graphql(query, {
          groupId: "non-existent-group",
          domain: domain,
          hostId: host_id
        }, suppress_errors: true)

        # エラーレスポンス検証
        expect(response["errors"]).not_to be_nil
        expect(response["errors"][0]["message"]).to include("Group not found")
      end
    end

    context "べき等性" do
      it "既に解散されたグループを再度解散しようとするとエラー" do
        # グループを作成
        group = create_test_group(group_name, host_id, domain)
        group_id = group["id"]

        # 1回目の解散（成功）
        query = File.read(File.join(__dir__, "../fixtures/mutations/dissolve_group.graphql"))
        response1 = execute_graphql(query, {
          groupId: group_id,
          domain: domain,
          hostId: host_id
        })

        expect(response1["errors"]).to be_nil

        # 2回目の解散（エラー）
        response2 = execute_graphql(query, {
          groupId: group_id,
          domain: domain,
          hostId: host_id
        }, suppress_errors: true)

        expect(response2["errors"]).not_to be_nil
        expect(response2["errors"][0]["message"]).to include("Group not found")
      end
    end
  end
end
