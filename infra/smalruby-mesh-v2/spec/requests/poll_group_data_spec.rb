require "spec_helper"

# issue #554: pollGroupData クエリの integration test。
# getEventsSince + listGroupStatuses を 1 リクエストに統合する Pipeline Resolver。
RSpec.describe "Poll group data API", type: :request do
  let(:timestamp) { (Time.now.to_f * 1000).to_i }
  let(:domain) { "test-poll-group-data-#{timestamp}.example.com" }
  let(:host_id) { "host-poll-#{timestamp}" }
  let(:node_id) { "node-poll-#{timestamp}" }
  let(:group) { create_test_group("Poll Group Data Test", host_id, domain, use_websocket: false) }
  let(:group_id) { group["id"] }

  let(:poll_query) {
    File.read(File.join(__dir__, "../fixtures/queries/poll_group_data.graphql"))
  }
  let(:record_events_query) {
    File.read(File.join(__dir__, "../fixtures/mutations/record_events_by_node.graphql"))
  }
  let(:report_data_query) {
    File.read(File.join(__dir__, "../fixtures/mutations/report_data_by_node.graphql"))
  }

  before do
    join_test_node(group_id, domain, node_id)
  end

  describe "pollGroupData query" do
    it "イベントとノードステータスを 1 リクエストで取得できる" do
      # イベントを記録
      events = [
        {eventName: "evt1", payload: nil, firedAt: "2026-04-28T00:00:00.000Z", orderKey: "20260428000000-0000001"},
        {eventName: "evt2", payload: nil, firedAt: "2026-04-28T00:00:00.000Z", orderKey: "20260428000000-0000002"}
      ]
      record_response = execute_graphql(record_events_query, {
        groupId: group_id, domain: domain, nodeId: node_id, events: events
      })
      expect(record_response["errors"]).to be_nil

      # センサーデータを報告
      execute_graphql(report_data_query, {
        groupId: group_id, domain: domain, nodeId: node_id,
        data: [{key: "score", value: "42"}, {key: "lives", value: "3"}]
      })

      sleep 0.5
      response = execute_graphql(poll_query, {
        groupId: group_id, domain: domain, since: ""
      })
      expect(response["errors"]).to be_nil
      data = response["data"]["pollGroupData"]

      # events が含まれる
      expect(data["events"].size).to eq(2)
      expect(data["events"].map { |e| e["name"] }).to eq(%w[evt1 evt2])
      expect(data["events"].map { |e| e["orderKey"] }).to eq(%w[20260428000000-0000001 20260428000000-0000002])

      # nodeStatuses も含まれる (host + member の 2 ノード分)
      expect(data["nodeStatuses"]).to be_an(Array)
      member_status = data["nodeStatuses"].find { |s| s["nodeId"] == node_id }
      expect(member_status).not_to be_nil
      expect(member_status["data"]).to include(
        a_hash_including("key" => "score", "value" => "42")
      )
    end

    it "イベントなしでも nodeStatuses は取得できる" do
      execute_graphql(report_data_query, {
        groupId: group_id, domain: domain, nodeId: node_id,
        data: [{key: "ready", value: "true"}]
      })

      sleep 0.5
      response = execute_graphql(poll_query, {
        groupId: group_id, domain: domain, since: ""
      })
      expect(response["errors"]).to be_nil
      data = response["data"]["pollGroupData"]
      expect(data["events"]).to eq([])
      member_status = data["nodeStatuses"].find { |s| s["nodeId"] == node_id }
      expect(member_status).not_to be_nil
    end

    it "ノードステータスなしでも events は取得できる (新規参加直後)" do
      events = [
        {eventName: "only_event", payload: nil, firedAt: "2026-04-28T00:00:00.000Z"}
      ]
      execute_graphql(record_events_query, {
        groupId: group_id, domain: domain, nodeId: node_id, events: events
      })

      sleep 0.5
      response = execute_graphql(poll_query, {
        groupId: group_id, domain: domain, since: ""
      })
      expect(response["errors"]).to be_nil
      data = response["data"]["pollGroupData"]
      expect(data["events"].size).to eq(1)
      expect(data["events"][0]["name"]).to eq("only_event")
      # nodeStatuses は空配列または既存ノード分のみ
      expect(data["nodeStatuses"]).to be_an(Array)
    end

    it "since cursor で増分取得できる (ページング)" do
      total = 110
      events = (1..total).map do |i|
        {
          eventName: "evt#{format("%03d", i)}",
          payload: nil,
          firedAt: "2026-04-28T00:00:00.000Z",
          orderKey: "20260428000000-#{format("%07d", i)}"
        }
      end
      execute_graphql(record_events_query, {
        groupId: group_id, domain: domain, nodeId: node_id, events: events
      })

      sleep 0.5
      page1 = execute_graphql(poll_query, {
        groupId: group_id, domain: domain, since: ""
      })["data"]["pollGroupData"]
      expect(page1["events"].size).to eq(100)

      # 続きを cursor で取得
      page2 = execute_graphql(poll_query, {
        groupId: group_id, domain: domain, since: page1["events"].last["cursor"]
      })["data"]["pollGroupData"]
      expect(page2["events"].size).to eq(10)

      combined = (page1["events"] + page2["events"]).map { |e| e["name"] }
      expected = (1..total).map { |i| "evt#{format("%03d", i)}" }
      expect(combined).to eq(expected)
    end
  end
end
