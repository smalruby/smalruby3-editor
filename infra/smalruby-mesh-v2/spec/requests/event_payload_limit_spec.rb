require "spec_helper"

# issue #1846: イベントの payload は 1000 文字まで（サーバー側の上限）
#
# - fireEventsByNode（WebSocket）: checkGroupExists が DB に触る前に検査し、errorType = "ValidationError"
# - recordEventsByNode（polling・Ruby Lambda）: MeshInput::ValidationError が errorType に入る
# - payload が無いイベント（今の GUI の形）は今までどおり通る
RSpec.describe "Mesh event payload limit", type: :request do
  let(:timestamp) { "#{Time.now.to_i}#{SecureRandom.hex(2)}" }
  let(:domain) { "test-payload-#{timestamp}.example.com" }
  let(:host_id) { SecureRandom.hex(16) }
  let(:node_id) { "#{SecureRandom.hex(16)}s07" }
  let!(:group) { create_test_group(host_id, host_id, domain) }
  let(:args) { {groupId: group["id"], domain: domain, nodeId: node_id} }

  before { join_test_node(group["id"], domain, node_id) }

  let(:fire_events_query) do
    <<~GRAPHQL
      mutation FireEventsByNode($groupId: ID!, $domain: String!, $nodeId: ID!, $events: [EventInput!]!) {
        fireEventsByNode(groupId: $groupId, domain: $domain, nodeId: $nodeId, events: $events) {
          groupId
          domain
          batchEvent {
            events {
              name
              payload
            }
          }
        }
      }
    GRAPHQL
  end

  let(:record_events_query) { File.read(File.join(__dir__, "../fixtures/mutations/record_events_by_node.graphql")) }

  def event(payload = :none)
    e = {eventName: "evt", firedAt: Time.now.utc.iso8601(3)}
    e[:payload] = payload unless payload == :none
    e
  end

  def expect_validation_error(response)
    expect(response["errors"]).not_to be_nil
    expect(response["errors"][0]["errorType"]).to match(/ValidationError/)
    expect(response["errors"][0]["message"]).to match(/payload must be 1000 characters or less/)
  end

  describe "fireEventsByNode" do
    it "payload ちょうど 1000 文字は通り、そのまま配信される" do
      response = execute_graphql(fire_events_query, args.merge(events: [event("a" * 1000)]))
      expect(response["errors"]).to be_nil
      expect(response["data"]["fireEventsByNode"]["batchEvent"]["events"][0]["payload"]).to eq("a" * 1000)
    end

    it "payload 1001 文字は ValidationError" do
      response = execute_graphql(fire_events_query, args.merge(events: [event("a" * 1001)]), suppress_errors: true)
      expect_validation_error(response)
    end

    # 文字数は UTF-16 のコード単位（絵文字は 2）。2 つの経路で同じ数え方になることを確かめる
    it "絵文字 500 個は通り、501 個は ValidationError" do
      expect(execute_graphql(fire_events_query, args.merge(events: [event("😀" * 500)]))["errors"]).to be_nil
      expect_validation_error(execute_graphql(fire_events_query, args.merge(events: [event("😀" * 501)]), suppress_errors: true))
    end

    it "payload が無いイベントは今までどおり通る" do
      response = execute_graphql(fire_events_query, args.merge(events: [event]))
      expect(response["errors"]).to be_nil
      expect(response["data"]["fireEventsByNode"]["batchEvent"]["events"][0]["payload"]).to be_nil
    end
  end

  describe "recordEventsByNode" do
    it "payload ちょうど 1000 文字は記録される" do
      response = execute_graphql(record_events_query, args.merge(events: [event("a" * 1000)]))
      expect(response["errors"]).to be_nil
      expect(response["data"]["recordEventsByNode"]["recordedCount"]).to eq(1)
    end

    it "payload 1001 文字は ValidationError" do
      response = execute_graphql(record_events_query, args.merge(events: [event("a" * 1001)]), suppress_errors: true)
      expect_validation_error(response)
    end

    it "絵文字 500 個は記録され、501 個は ValidationError" do
      expect(execute_graphql(record_events_query, args.merge(events: [event("😀" * 500)]))["errors"]).to be_nil
      expect_validation_error(execute_graphql(record_events_query, args.merge(events: [event("😀" * 501)]), suppress_errors: true))
    end

    it "payload が無いイベントは今までどおり記録される" do
      response = execute_graphql(record_events_query, args.merge(events: [event]))
      expect(response["errors"]).to be_nil
      expect(response["data"]["recordEventsByNode"]["recordedCount"]).to eq(1)
    end
  end
end
