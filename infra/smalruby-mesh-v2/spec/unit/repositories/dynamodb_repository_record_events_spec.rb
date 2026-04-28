# frozen_string_literal: true

require "spec_helper"
require_relative "../../../lambda/repositories/dynamodb_repository"

# issue #556: orderKey 対応を含む record_events の挙動を検証する。
RSpec.describe DynamoDBRepository, "#record_events" do
  let(:dynamodb_client) { double("DynamoDBClient") }
  let(:table_name) { "MeshV2Table-test" }
  let(:repository) { described_class.new(dynamodb_client, table_name) }
  let(:group_id) { "g-1" }
  let(:domain) { "d-1" }
  let(:node_id) { "n-1" }

  before do
    # find_group は記録時に直接呼ばれないが、固定して念のため許可しておく
    allow(dynamodb_client).to receive(:batch_write_item)
  end

  context "orderKey が指定されている場合" do
    it "SK に EVENT#<server_timestamp>#<orderKey>#<short_uuid> 形式を使う" do
      events = [
        {"eventName" => "e1", "payload" => nil, "orderKey" => "20260428090000-001"}
      ]

      expect(dynamodb_client).to receive(:batch_write_item) do |args|
        put = args[:request_items][table_name].first[:put_request][:item]
        expect(put["sk"]).to match(/\AEVENT#[^#]+#20260428090000-001#[a-f0-9]{8}\z/)
        expect(put["orderKey"]).to eq("20260428090000-001")
      end

      result = repository.record_events(group_id, domain, node_id, events, 10)
      expect(result[:success]).to eq(true)
      expect(result[:recordedCount]).to eq(1)
      expect(result[:last_sk]).to match(/\AEVENT#[^#]+#20260428090000-001#[a-f0-9]{8}\z/)
    end

    it "同一バッチで送られた異なる orderKey のイベントは orderKey 部分の辞書順で並ぶ SK になる" do
      events = [
        {"eventName" => "first", "payload" => nil, "orderKey" => "20260428090000-001"},
        {"eventName" => "second", "payload" => nil, "orderKey" => "20260428090000-002"},
        {"eventName" => "third", "payload" => nil, "orderKey" => "20260428090000-003"}
      ]
      captured = []
      expect(dynamodb_client).to receive(:batch_write_item) do |args|
        captured = args[:request_items][table_name].map { |r| r[:put_request][:item] }
      end

      repository.record_events(group_id, domain, node_id, events, 10)
      sks = captured.map { |i| i["sk"] }
      # 同一 server_timestamp 配下では orderKey の辞書順 = 送信順
      expect(sks.sort).to eq(sks)
      expect(captured.map { |i| i["eventName"] }).to eq(%w[first second third])
    end
  end

  context "orderKey が未指定（旧クライアント）の場合" do
    it "SK は EVENT#<server_timestamp>#<uuid> 形式（後方互換）" do
      events = [{"eventName" => "legacy", "payload" => nil}]

      expect(dynamodb_client).to receive(:batch_write_item) do |args|
        put = args[:request_items][table_name].first[:put_request][:item]
        # UUID v4 形式（8-4-4-4-12）
        expect(put["sk"]).to match(/\AEVENT#[^#]+#[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\z/)
        expect(put).not_to have_key("orderKey")
      end

      repository.record_events(group_id, domain, node_id, events, 10)
    end

    it "orderKey が空文字でも uuid 形式にフォールバックする" do
      events = [{"eventName" => "empty", "payload" => nil, "orderKey" => ""}]

      expect(dynamodb_client).to receive(:batch_write_item) do |args|
        put = args[:request_items][table_name].first[:put_request][:item]
        expect(put["sk"]).to match(/\AEVENT#[^#]+#[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\z/)
        expect(put).not_to have_key("orderKey")
      end

      repository.record_events(group_id, domain, node_id, events, 10)
    end
  end

  context "orderKey 付きと未指定が混在する場合（新旧クライアント混在）" do
    it "それぞれ適切な SK 形式で保存される" do
      events = [
        {"eventName" => "new", "payload" => nil, "orderKey" => "20260428090000-001"},
        {"eventName" => "old", "payload" => nil}
      ]
      captured = []
      expect(dynamodb_client).to receive(:batch_write_item) do |args|
        captured = args[:request_items][table_name].map { |r| r[:put_request][:item] }
      end

      repository.record_events(group_id, domain, node_id, events, 10)

      expect(captured[0]["sk"]).to include("#20260428090000-001#")
      expect(captured[0]).to have_key("orderKey")
      expect(captured[1]["sk"]).to match(/\A.*#[a-f0-9]{8}-[a-f0-9]{4}-/)
      expect(captured[1]).not_to have_key("orderKey")
    end
  end
end
