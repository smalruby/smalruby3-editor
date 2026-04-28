require "spec_helper"

# issue #556: orderKey によるバッチイベント順序保証の integration test。
RSpec.describe "Event ordering with orderKey", type: :request do
  let(:timestamp) { (Time.now.to_f * 1000).to_i }
  let(:domain) { "test-event-order-#{timestamp}.example.com" }
  let(:host_id) { "host-event-order-#{timestamp}" }
  let(:node_id) { "node-event-order-#{timestamp}" }
  let(:group) { create_test_group("Event Order Test Group", host_id, domain, use_websocket: false) }
  let(:group_id) { group["id"] }

  let(:record_events_query) {
    File.read(File.join(__dir__, "../fixtures/mutations/record_events_by_node.graphql"))
  }
  let(:get_events_since_query) {
    File.read(File.join(__dir__, "../fixtures/queries/get_events_since.graphql"))
  }

  before do
    # メンバーノードを参加させてからイベントを送信
    join_test_node(group_id, domain, node_id)
  end

  describe "recordEventsByNode mutation with orderKey" do
    it "orderKey を付けて送信した複数イベントが送信順で取得できる" do
      events = [
        {eventName: "first",  payload: nil, firedAt: "2026-04-28T00:00:00.000Z", orderKey: "20260428090000-001"},
        {eventName: "second", payload: nil, firedAt: "2026-04-28T00:00:00.000Z", orderKey: "20260428090000-002"},
        {eventName: "third",  payload: nil, firedAt: "2026-04-28T00:00:00.000Z", orderKey: "20260428090000-003"}
      ]

      record_response = execute_graphql(record_events_query, {
        groupId: group_id,
        domain: domain,
        nodeId: node_id,
        events: events
      })
      expect(record_response["errors"]).to be_nil
      expect(record_response["data"]["recordEventsByNode"]["recordedCount"]).to eq(3)

      # 取得して送信順と一致するか確認
      sleep 0.5  # DynamoDB の書き込み伝播待ち（GSI ではなくメインテーブル参照だが念のため）
      events_response = execute_graphql(get_events_since_query, {
        groupId: group_id,
        domain: domain,
        since: ""
      })
      expect(events_response["errors"]).to be_nil
      retrieved = events_response["data"]["getEventsSince"]

      names = retrieved.map { |e| e["name"] }
      expect(names).to eq(%w[first second third])

      # orderKey がレスポンスに含まれる
      order_keys = retrieved.map { |e| e["orderKey"] }
      expect(order_keys).to eq(%w[20260428090000-001 20260428090000-002 20260428090000-003])
    end

    it "orderKey を省略しても録画でき、orderKey は null で返る（後方互換）" do
      events = [
        {eventName: "legacy1", payload: nil, firedAt: "2026-04-28T00:00:00.000Z"},
        {eventName: "legacy2", payload: nil, firedAt: "2026-04-28T00:00:00.000Z"}
      ]

      record_response = execute_graphql(record_events_query, {
        groupId: group_id,
        domain: domain,
        nodeId: node_id,
        events: events
      })
      expect(record_response["errors"]).to be_nil
      expect(record_response["data"]["recordEventsByNode"]["recordedCount"]).to eq(2)

      sleep 0.5
      events_response = execute_graphql(get_events_since_query, {
        groupId: group_id,
        domain: domain,
        since: ""
      })
      expect(events_response["errors"]).to be_nil
      retrieved = events_response["data"]["getEventsSince"]
      expect(retrieved.size).to eq(2)
      expect(retrieved.map { |e| e["orderKey"] }).to all(be_nil)
    end

    it "新旧クライアント混在（orderKey あり/なし）のイベントを記録できる" do
      events = [
        {eventName: "with_key",    payload: nil, firedAt: "2026-04-28T00:00:00.000Z", orderKey: "20260428090000-001"},
        {eventName: "without_key", payload: nil, firedAt: "2026-04-28T00:00:00.000Z"}
      ]

      record_response = execute_graphql(record_events_query, {
        groupId: group_id,
        domain: domain,
        nodeId: node_id,
        events: events
      })
      expect(record_response["errors"]).to be_nil
      expect(record_response["data"]["recordEventsByNode"]["recordedCount"]).to eq(2)

      sleep 0.5
      events_response = execute_graphql(get_events_since_query, {
        groupId: group_id,
        domain: domain,
        since: ""
      })
      expect(events_response["errors"]).to be_nil
      retrieved = events_response["data"]["getEventsSince"]
      expect(retrieved.size).to eq(2)

      with_key = retrieved.find { |e| e["name"] == "with_key" }
      without_key = retrieved.find { |e| e["name"] == "without_key" }
      expect(with_key["orderKey"]).to eq("20260428090000-001")
      expect(without_key["orderKey"]).to be_nil
    end
  end
end
