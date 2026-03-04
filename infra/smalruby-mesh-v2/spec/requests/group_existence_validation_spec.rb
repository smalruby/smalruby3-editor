require "spec_helper"

RSpec.describe "Group Existence Validation", type: :request do
  let(:domain) { "test-validation-#{Time.now.to_i}.example.com" }
  let(:host_id) { "host-validation-#{Time.now.to_i}" }
  let(:node_id) { "node-validation-#{Time.now.to_i}" }
  let(:group_name) { "Test Validation Group" }

  describe "joinGroup mutation" do
    context "グループが存在しない場合" do
      it "エラーを返す" do
        query = File.read(File.join(__dir__, "../fixtures/mutations/join_group.graphql"))
        response = execute_graphql(query, {
          groupId: "non-existent-group",
          domain: domain,
          nodeId: node_id
        }, suppress_errors: true)

        # エラーレスポンス検証
        # Pipeline resolver with checkGroupExists returns custom error message
        expect(response["errors"]).not_to be_nil
        expect(response["errors"][0]["message"]).to include("not found")
        expect(response["errors"][0]["errorType"]).to eq("GroupNotFound")
      end
    end

    context "グループが削除された後" do
      it "エラーを返す" do
        # グループを作成
        group = create_test_group(group_name, host_id, domain)
        group_id = group["id"]

        # グループを削除
        dissolve_query = File.read(File.join(__dir__, "../fixtures/mutations/dissolve_group.graphql"))
        dissolve_response = execute_graphql(dissolve_query, {
          groupId: group_id,
          domain: domain,
          hostId: host_id
        })
        expect(dissolve_response["errors"]).to be_nil
        expect(dissolve_response["data"]["dissolveGroup"]).not_to be_nil
        # Verify top-level filtering fields
        expect(dissolve_response["data"]["dissolveGroup"]["groupId"]).to eq(group_id)
        expect(dissolve_response["data"]["dissolveGroup"]["domain"]).to eq(domain)

        # 削除されたグループに参加を試みる
        join_query = File.read(File.join(__dir__, "../fixtures/mutations/join_group.graphql"))
        join_response = execute_graphql(join_query, {
          groupId: group_id,
          domain: domain,
          nodeId: node_id
        }, suppress_errors: true)

        # エラーレスポンス検証
        expect(join_response["errors"]).not_to be_nil
        expect(join_response["errors"][0]["message"]).to include("not found")
        expect(join_response["errors"][0]["errorType"]).to eq("GroupNotFound")
      end
    end
  end

  describe "reportDataByNode mutation" do
    context "グループが存在しない場合" do
      it "エラーを返す" do
        query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
        response = execute_graphql(query, {
          groupId: "non-existent-group",
          domain: domain,
          nodeId: node_id,
          data: [
            {key: "temperature", value: "25.5"},
            {key: "humidity", value: "60"}
          ]
        }, suppress_errors: true)

        # エラーレスポンス検証
        # Pipeline resolver with checkGroupExists returns custom error message
        expect(response["errors"]).not_to be_nil
        expect(response["errors"][0]["message"]).to include("not found")
        expect(response["errors"][0]["errorType"]).to eq("GroupNotFound")
      end
    end

    context "グループが削除された後" do
      it "エラーを返す" do
        # グループを作成してノードを参加させる
        group = create_test_group(group_name, host_id, domain)
        group_id = group["id"]
        join_test_node(group_id, domain, node_id)

        # グループを削除
        dissolve_query = File.read(File.join(__dir__, "../fixtures/mutations/dissolve_group.graphql"))
        dissolve_response = execute_graphql(dissolve_query, {
          groupId: group_id,
          domain: domain,
          hostId: host_id
        })
        expect(dissolve_response["errors"]).to be_nil
        expect(dissolve_response["data"]["dissolveGroup"]).not_to be_nil
        expect(dissolve_response["data"]["dissolveGroup"]["groupId"]).to eq(group_id)
        expect(dissolve_response["data"]["dissolveGroup"]["domain"]).to eq(domain)

        # 削除されたグループにデータを報告を試みる
        report_query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
        report_response = execute_graphql(report_query, {
          groupId: group_id,
          domain: domain,
          nodeId: node_id,
          data: [
            {key: "temperature", value: "25.5"}
          ]
        }, suppress_errors: true)

        # エラーレスポンス検証
        expect(report_response["errors"]).not_to be_nil
        expect(report_response["errors"][0]["message"]).to include("not found")
      end
    end
  end

  describe "E2E: dissolveGroup後のすべてのmutation検証" do
    it "dissolveGroup後、すべてのグループ操作がエラーを返す" do
      # グループを作成
      group = create_test_group(group_name, host_id, domain)
      group_id = group["id"]

      # ノードを参加させる
      join_test_node(group_id, domain, node_id)

      # グループを削除
      dissolve_query = File.read(File.join(__dir__, "../fixtures/mutations/dissolve_group.graphql"))
      dissolve_response = execute_graphql(dissolve_query, {
        groupId: group_id,
        domain: domain,
        hostId: host_id
      })
      expect(dissolve_response["errors"]).to be_nil
      expect(dissolve_response["data"]["dissolveGroup"]).not_to be_nil
      expect(dissolve_response["data"]["dissolveGroup"]["groupId"]).to eq(group_id)
      expect(dissolve_response["data"]["dissolveGroup"]["domain"]).to eq(domain)
      expect(dissolve_response["data"]["dissolveGroup"]["groupDissolve"]["message"]).to include("dissolved")

      # 新しいノードの参加を試みる（エラーになるべき）
      new_node_id = "new-node-#{Time.now.to_i}"
      join_query = File.read(File.join(__dir__, "../fixtures/mutations/join_group.graphql"))
      join_response = execute_graphql(join_query, {
        groupId: group_id,
        domain: domain,
        nodeId: new_node_id
      }, suppress_errors: true)
      expect(join_response["errors"]).not_to be_nil
      expect(join_response["errors"][0]["message"]).to include("not found")
      expect(join_response["errors"][0]["errorType"]).to eq("GroupNotFound")

      # データ報告を試みる（エラーになるべき）
      report_query = File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
      report_response = execute_graphql(report_query, {
        groupId: group_id,
        domain: domain,
        nodeId: node_id,
        data: [{key: "test", value: "value"}]
      }, suppress_errors: true)
      expect(report_response["errors"]).not_to be_nil
      expect(report_response["errors"][0]["message"]).to include("not found")
    end
  end
end
