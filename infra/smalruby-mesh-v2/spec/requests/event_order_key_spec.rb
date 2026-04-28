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
        {eventName: "first", payload: nil, firedAt: "2026-04-28T00:00:00.000Z", orderKey: "20260428090000-001"},
        {eventName: "second", payload: nil, firedAt: "2026-04-28T00:00:00.000Z", orderKey: "20260428090000-002"},
        {eventName: "third", payload: nil, firedAt: "2026-04-28T00:00:00.000Z", orderKey: "20260428090000-003"}
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
        {eventName: "with_key", payload: nil, firedAt: "2026-04-28T00:00:00.000Z", orderKey: "20260428090000-001"},
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

  describe "corner cases" do
    # コーナーケース 1: 26 件以上のバッチ
    # record_events.rb は each_slice(25) で BatchWriteItem を分割する。
    # 分割境界で SK の orderKey 部分が辞書順を保つことを確認。
    it "26+ events split across BatchWriteItem boundaries preserve send order" do
      total = 30
      events = (1..total).map do |i|
        {
          eventName: "evt#{format("%02d", i)}",
          payload: nil,
          firedAt: "2026-04-28T00:00:00.000Z",
          orderKey: "20260428090000-#{format("%03d", i)}"
        }
      end

      record_response = execute_graphql(record_events_query, {
        groupId: group_id, domain: domain, nodeId: node_id, events: events
      })
      expect(record_response["errors"]).to be_nil
      expect(record_response["data"]["recordEventsByNode"]["recordedCount"]).to eq(total)

      sleep 0.5
      events_response = execute_graphql(get_events_since_query, {
        groupId: group_id, domain: domain, since: ""
      })
      expect(events_response["errors"]).to be_nil
      retrieved = events_response["data"]["getEventsSince"]
      # getEventsSince の limit:100 以下なので一度で取得可能
      expect(retrieved.size).to eq(total)
      expected_names = (1..total).map { |i| "evt#{format("%02d", i)}" }
      expect(retrieved.map { |e| e["name"] }).to eq(expected_names)
    end

    # コーナーケース 2: getEventsSince ページング
    # query は limit:100 を指定。100 件超のイベントを記録して、cursor で
    # 複数回呼び出しても全件取得・順序保持できることを確認。
    it "events beyond limit:100 are retrievable via cursor pagination in correct order" do
      total = 150
      events = (1..total).map do |i|
        {
          eventName: "evt#{format("%03d", i)}",
          payload: nil,
          firedAt: "2026-04-28T00:00:00.000Z",
          orderKey: "20260428090000-#{format("%03d", i)}"
        }
      end

      record_response = execute_graphql(record_events_query, {
        groupId: group_id, domain: domain, nodeId: node_id, events: events
      })
      expect(record_response["errors"]).to be_nil
      expect(record_response["data"]["recordEventsByNode"]["recordedCount"]).to eq(total)

      sleep 0.5
      # 1 ページ目: 最大 100 件
      page1 = execute_graphql(get_events_since_query, {
        groupId: group_id, domain: domain, since: ""
      })["data"]["getEventsSince"]
      expect(page1.size).to eq(100)

      # 2 ページ目: cursor で続きを取得
      page2 = execute_graphql(get_events_since_query, {
        groupId: group_id, domain: domain, since: page1.last["cursor"]
      })["data"]["getEventsSince"]
      expect(page2.size).to eq(50)

      # 結合して全件・送信順を確認
      combined_names = (page1 + page2).map { |e| e["name"] }
      expected_names = (1..total).map { |i| "evt#{format("%03d", i)}" }
      expect(combined_names).to eq(expected_names)
    end

    # コーナーケース 3: orderKey に SK 区切り文字 '#' を含む
    # SK は EVENT#<ts>#<orderKey>#<short_uuid> 形式。orderKey に '#' が含まれると
    # SK のセグメント数が変わるが、DynamoDB query は文字列比較のみなのでクラッシュ
    # しない。orderKey 属性も元の値が保たれる。
    it "orderKey containing '#' separator does not break SK parsing or cursor pagination" do
      events = [
        {
          eventName: "with_hash",
          payload: nil,
          firedAt: "2026-04-28T00:00:00.000Z",
          orderKey: "20260428090000-001#injected"
        }
      ]

      record_response = execute_graphql(record_events_query, {
        groupId: group_id, domain: domain, nodeId: node_id, events: events
      })
      expect(record_response["errors"]).to be_nil
      expect(record_response["data"]["recordEventsByNode"]["recordedCount"]).to eq(1)

      sleep 0.5
      events_response = execute_graphql(get_events_since_query, {
        groupId: group_id, domain: domain, since: ""
      })
      expect(events_response["errors"]).to be_nil
      retrieved = events_response["data"]["getEventsSince"]
      expect(retrieved.size).to eq(1)
      expect(retrieved[0]["name"]).to eq("with_hash")
      # orderKey 属性は元の値そのまま（SK の '#' 分割では破壊されない）
      expect(retrieved[0]["orderKey"]).to eq("20260428090000-001#injected")

      # cursor で再 query しても crash しない
      page2 = execute_graphql(get_events_since_query, {
        groupId: group_id, domain: domain, since: retrieved[0]["cursor"]
      })["data"]["getEventsSince"]
      expect(page2).to eq([])
    end

    # コーナーケース 4: 複数ノードの並行送信
    # 異なる nodeId が同時に recordEventsByNode を呼び出す。各ノードの送信順は
    # 保持される (per-client orderKey が単調増加なので)。ノード間順序は
    # server_timestamp 依存で interleave しうる。
    it "events from multiple nodes preserve per-client send order" do
      node_a = "node-a-#{timestamp}"
      node_b = "node-b-#{timestamp}"
      join_test_node(group_id, domain, node_a)
      join_test_node(group_id, domain, node_b)

      events_a = (1..3).map do |i|
        {
          eventName: "a#{i}",
          payload: nil,
          firedAt: "2026-04-28T00:00:00.000Z",
          orderKey: "20260428090000-#{format("%03d", i)}"
        }
      end
      # 同じ orderKey 連番だが nodeId が異なる。SK の short_uuid suffix で
      # 一意性が確保される
      events_b = (1..3).map do |i|
        {
          eventName: "b#{i}",
          payload: nil,
          firedAt: "2026-04-28T00:00:00.000Z",
          orderKey: "20260428090000-#{format("%03d", i)}"
        }
      end

      threads = [
        Thread.new {
          execute_graphql(record_events_query, {
            groupId: group_id, domain: domain, nodeId: node_a, events: events_a
          })
        },
        Thread.new {
          execute_graphql(record_events_query, {
            groupId: group_id, domain: domain, nodeId: node_b, events: events_b
          })
        }
      ]
      threads.each(&:join)

      sleep 1
      events_response = execute_graphql(get_events_since_query, {
        groupId: group_id, domain: domain, since: ""
      })
      retrieved = events_response["data"]["getEventsSince"]
      expect(retrieved.size).to eq(6)

      # 各ノード内の順序が保たれる
      a_events = retrieved.select { |e| e["name"].start_with?("a") }.map { |e| e["name"] }
      b_events = retrieved.select { |e| e["name"].start_with?("b") }.map { |e| e["name"] }
      expect(a_events).to eq(%w[a1 a2 a3])
      expect(b_events).to eq(%w[b1 b2 b3])
    end

    # コーナーケース 5: WebSocket subscription 経由の orderKey
    # fireEventsByNode (WebSocket モード時) のレスポンスは subscription
    # ペイロードと同じ。batchEvent.events に orderKey が含まれることで、
    # 受信側のクライアントが安定ソートに使える。
    it "fireEventsByNode passes orderKey through batchEvent (subscription payload)" do
      ws_domain = "ws-#{domain}"
      ws_group = create_test_group(
        "WS Group", "host-ws-#{timestamp}", ws_domain, use_websocket: true
      )
      ws_group_id = ws_group["id"]
      ws_node_id = "ws-node-#{timestamp}"
      join_test_node(ws_group_id, ws_domain, ws_node_id)

      fire_events_query = <<~GRAPHQL
        mutation FireEventsByNode($groupId: ID!, $domain: String!, $nodeId: ID!, $events: [EventInput!]!) {
          fireEventsByNode(groupId: $groupId, domain: $domain, nodeId: $nodeId, events: $events) {
            groupId
            domain
            batchEvent {
              events {
                name
                orderKey
              }
            }
          }
        }
      GRAPHQL

      events = [
        {eventName: "ws_evt1", payload: nil, firedAt: "2026-04-28T00:00:00.000Z", orderKey: "20260428090000-001"},
        {eventName: "ws_evt2", payload: nil, firedAt: "2026-04-28T00:00:00.000Z", orderKey: "20260428090000-002"}
      ]
      response = execute_graphql(fire_events_query, {
        groupId: ws_group_id, domain: ws_domain, nodeId: ws_node_id, events: events
      })
      expect(response["errors"]).to be_nil
      retrieved = response["data"]["fireEventsByNode"]["batchEvent"]["events"]
      expect(retrieved.map { |e| e["name"] }).to eq(%w[ws_evt1 ws_evt2])
      expect(retrieved.map { |e| e["orderKey"] }).to eq(%w[20260428090000-001 20260428090000-002])
    end

    # コーナーケース 6: orderKey の時刻部分が巻き戻る (NTP ずれ等)
    # クライアント時計が前後しても、SK は orderKey の辞書順で並ぶ。
    # つまり「送信順」ではなく「orderKey 順」で取得される、という制限の確認。
    # この挙動は仕様上のトレードオフ（送信順を厳密に追うには別途
    # シーケンス番号のみで構成する選択肢もあるが、人間可読性とのバランスで
    # 時刻+連番を採用）。
    it "documents orderKey lexicographic order beats actual send order on clock skew" do
      # 後で送ったが orderKey の時刻部分は早い (NTP 巻き戻し)
      events = [
        {eventName: "later_send", payload: nil, firedAt: "2026-04-28T00:00:00.000Z", orderKey: "20260428090005-001"},
        {eventName: "earlier_key", payload: nil, firedAt: "2026-04-28T00:00:00.000Z", orderKey: "20260428090000-002"}
      ]

      record_response = execute_graphql(record_events_query, {
        groupId: group_id, domain: domain, nodeId: node_id, events: events
      })
      expect(record_response["errors"]).to be_nil

      sleep 0.5
      events_response = execute_graphql(get_events_since_query, {
        groupId: group_id, domain: domain, since: ""
      })
      retrieved = events_response["data"]["getEventsSince"]

      # SK ソート = orderKey 辞書順。送信順 (later_send → earlier_key) ではなく
      # orderKey 順 (earlier_key → later_send) で並ぶ。
      expect(retrieved.map { |e| e["name"] }).to eq(%w[earlier_key later_send])
    end
  end
end
