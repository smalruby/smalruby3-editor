require "spec_helper"
require_relative "../../../lambda/use_cases/record_events"

# issue #1267: recordEventsByNode の入力上限
RSpec.describe RecordEventsUseCase do
  let(:repository) { double("Repository") }
  let(:use_case) { described_class.new(repository) }
  let(:group_id) { "group-1" }
  let(:domain) { "example.com" }
  let(:events) { [{"name" => "a", "firedByNodeId" => "n", "payload" => "1", "timestamp" => "t"}] }

  it "今のクライアントのノード ID（…s07）は通す" do
    node_id = "0123456789abcdef0123456789abcdefs07"
    allow(repository).to receive(:find_group).and_return(double("Group"))
    allow(repository).to receive(:record_events).and_return({success: true, recordedCount: 1, last_sk: "EVENT#x"})
    result = use_case.execute(group_id: group_id, domain: domain, node_id: node_id, events: events)
    expect(result[:success]).to be true
  end

  it "長すぎる nodeId は ValidationError（DB に触らない）" do
    expect(repository).not_to receive(:find_group)
    expect {
      use_case.execute(group_id: group_id, domain: domain, node_id: "a" * 129, events: events)
    }.to raise_error(MeshInput::ValidationError, /nodeId/)
  end

  it "使えない文字の nodeId は ValidationError" do
    expect {
      use_case.execute(group_id: group_id, domain: domain, node_id: "node|1", events: events)
    }.to raise_error(MeshInput::ValidationError, /nodeId/)
  end

  # issue #1846: payload は 1000 文字まで
  it "payload ちょうど 1000 文字は記録する" do
    allow(repository).to receive(:find_group).and_return(double("Group"))
    allow(repository).to receive(:record_events).and_return({success: true, recordedCount: 1, last_sk: "EVENT#x"})
    result = use_case.execute(group_id: group_id, domain: domain, node_id: "node-1",
      events: [{"eventName" => "a", "payload" => "a" * 1000}])
    expect(result[:success]).to be true
  end

  it "payload が無いイベントは記録する" do
    allow(repository).to receive(:find_group).and_return(double("Group"))
    allow(repository).to receive(:record_events).and_return({success: true, recordedCount: 1, last_sk: "EVENT#x"})
    result = use_case.execute(group_id: group_id, domain: domain, node_id: "node-1",
      events: [{"eventName" => "a"}])
    expect(result[:success]).to be true
  end

  it "payload 1001 文字は ValidationError（DB に触らない）" do
    expect(repository).not_to receive(:find_group)
    expect(repository).not_to receive(:record_events)
    expect {
      use_case.execute(group_id: group_id, domain: domain, node_id: "node-1",
        events: [{"eventName" => "a", "payload" => "a" * 1001}])
    }.to raise_error(MeshInput::ValidationError, /payload must be 1000 characters or less/)
  end
end
