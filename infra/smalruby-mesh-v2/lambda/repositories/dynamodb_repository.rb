require "aws-sdk-dynamodb"
require "securerandom"
require_relative "../domain/group"

# DynamoDB Repository
# データアクセス層 - DynamoDBとの通信を担当
class DynamoDBRepository
  def initialize(dynamodb_client = nil, table_name = nil)
    @dynamodb = dynamodb_client
    @table_name = table_name || ENV["DYNAMODB_TABLE_NAME"] || "MeshV2Table-stg"
  end

  # hostId + domain でグループを検索
  def find_group_by_host_and_domain(host_id, domain)
    return nil unless @dynamodb

    # DynamoDB Query操作
    # pk = DOMAIN#{domain}, sk begins_with GROUP#
    # FilterExpression: hostId = :hostId
    result = @dynamodb.query(
      table_name: @table_name,
      key_condition_expression: "pk = :pk AND begins_with(sk, :sk_prefix)",
      expression_attribute_values: {
        ":pk" => "DOMAIN##{domain}",
        ":sk_prefix" => "GROUP#",
        ":hostId" => host_id
      },
      filter_expression: "hostId = :hostId"
    )

    items = result.items.select { |item| item["sk"].end_with?("#METADATA") }
    return nil if items.empty?

    item_to_group(items.first)
  rescue Aws::DynamoDB::Errors::ServiceError => e
    # エラーハンドリング（ログ出力など）
    puts "DynamoDB Error: #{e.message}"
    nil
  end

  # グループを保存
  def save_group(group)
    return false unless @dynamodb

    # DynamoDB PutItem操作
    @dynamodb.put_item(
      table_name: @table_name,
      item: {
        "pk" => "DOMAIN##{group.domain}",
        "sk" => "GROUP##{group.id}#METADATA",
        "id" => group.id,
        "domain" => group.domain,
        "fullId" => group.full_id,
        "name" => group.name,
        "hostId" => group.host_id,
        "createdAt" => group.created_at,
        "useWebSocket" => group.use_websocket,
        "pollingIntervalSeconds" => group.polling_interval_seconds,
        "gsi_pk" => "GROUP##{group.id}",
        "gsi_sk" => "DOMAIN##{group.domain}"
      }
    )
    true
  rescue Aws::DynamoDB::Errors::ServiceError => e
    puts "DynamoDB Error: #{e.message}"
    false
  end

  # グループIDとドメインでグループを検索
  def find_group(group_id, domain)
    return nil unless @dynamodb

    result = @dynamodb.get_item(
      table_name: @table_name,
      key: {
        "pk" => "DOMAIN##{domain}",
        "sk" => "GROUP##{group_id}#METADATA"
      }
    )

    return nil unless result.item

    item_to_group(result.item)
  rescue Aws::DynamoDB::Errors::ServiceError => e
    puts "DynamoDB Error: #{e.message}"
    nil
  end

  # グループ全体を削除（ホスト退出時）
  def dissolve_group(group_id, domain)
    return false unless @dynamodb

    # 1. グループ内の全アイテムを取得
    result = @dynamodb.query(
      table_name: @table_name,
      key_condition_expression: "pk = :pk AND begins_with(sk, :sk_prefix)",
      expression_attribute_values: {
        ":pk" => "DOMAIN##{domain}",
        ":sk_prefix" => "GROUP##{group_id}"
      }
    )

    # 2. 全アイテムを削除
    result.items.each do |item|
      # UTF-8エンコーディングを明示的に強制（マルチバイト文字対策）
      pk = item["pk"]
      sk = item["sk"]

      @dynamodb.delete_item(
        table_name: @table_name,
        key: {
          "pk" => pk,
          "sk" => sk
        }
      )
    end

    # 3. 各ノードの所属情報も削除
    node_items = result.items.select { |item| item["sk"].include?("#NODE#") }
    node_items.each do |item|
      node_id = item["nodeId"]
      @dynamodb.delete_item(
        table_name: @table_name,
        key: {
          "pk" => "NODE##{node_id}",
          "sk" => "METADATA"
        }
      )
    end

    true
  rescue Aws::DynamoDB::Errors::ServiceError => e
    puts "DynamoDB Error: #{e.message}"
    false
  end

  # ノードをグループから削除（一般メンバー退出時）
  def remove_node_from_group(group_id, domain, node_id)
    return false unless @dynamodb

    # TransactWriteItems でアトミックに削除
    @dynamodb.transact_write_items(
      transact_items: [
        # 1. グループ内のノード情報を削除
        {
          delete: {
            table_name: @table_name,
            key: {
              "pk" => "DOMAIN##{domain}",
              "sk" => "GROUP##{group_id}#NODE##{node_id}"
            }
          }
        },
        # 2. ノードの所属情報を削除
        {
          delete: {
            table_name: @table_name,
            key: {
              "pk" => "NODE##{node_id}",
              "sk" => "METADATA"
            }
          }
        }
      ]
    )

    true
  rescue Aws::DynamoDB::Errors::ServiceError => e
    puts "DynamoDB Error: #{e.message}"
    false
  end

  # ピアのデータを削除（NodeStatus削除）
  def delete_peer_data(group_id, domain, peer_id)
    return false unless @dynamodb

    # NodeStatusデータを削除
    @dynamodb.delete_item(
      table_name: @table_name,
      key: {
        "pk" => "DOMAIN##{domain}",
        "sk" => "GROUP##{group_id}#NODE##{peer_id}#STATUS"
      }
    )

    true
  rescue Aws::DynamoDB::Errors::ServiceError => e
    puts "DynamoDB Error: #{e.message}"
    false
  end

  # イベントをバッチ保存
  def record_events(group_id, domain, node_id, events, ttl_seconds)
    return {success: false, error: "DynamoDB client not initialized"} unless @dynamodb

    server_timestamp = Time.now.iso8601
    ttl = Time.now.to_i + ttl_seconds
    last_sk = nil

    # DynamoDB BatchWriteItem 操作
    # 最大25アイテムまで
    events.each_slice(25) do |slice|
      put_requests = slice.map do |event|
        sk = "EVENT##{server_timestamp}##{SecureRandom.uuid}"
        last_sk = sk
        {
          put_request: {
            item: {
              "pk" => "GROUP##{group_id}@#{domain}",
              "sk" => sk,
              "eventName" => event["eventName"],
              "firedByNodeId" => node_id,
              "groupId" => group_id,
              "domain" => domain,
              "payload" => event["payload"],
              "timestamp" => server_timestamp,
              "ttl" => ttl
            }
          }
        }
      end

      @dynamodb.batch_write_item(
        request_items: {
          @table_name => put_requests
        }
      )
    end
    {success: true, recordedCount: events.length, last_sk: last_sk}
  rescue Aws::DynamoDB::Errors::ServiceError => e
    puts "DynamoDB Error: #{e.message}"
    {success: false, error: e.message}
  end

  private

  def item_to_group(item)
    Group.new(
      id: item["id"],
      name: item["name"],
      host_id: item["hostId"],
      domain: item["domain"],
      created_at: item["createdAt"],
      use_websocket: item.key?("useWebSocket") ? item["useWebSocket"] : true,
      polling_interval_seconds: item["pollingIntervalSeconds"]
    )
  end
end
