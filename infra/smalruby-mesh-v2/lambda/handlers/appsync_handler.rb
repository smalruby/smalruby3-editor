Encoding.default_external = "UTF-8"

require_relative "../use_cases/create_group"
require_relative "../use_cases/dissolve_group"
require_relative "../use_cases/leave_group"
require_relative "../use_cases/create_domain"
require_relative "../use_cases/record_events"
require_relative "../repositories/dynamodb_repository"
require "aws-sdk-dynamodb"
require "json"

# AppSync Lambda Handler
# Adapter層 - AppSyncイベントの受け取りと値抽出のみ
def lambda_handler(event:, context:)
  # AppSyncイベントから値を抽出
  field_name = event["info"]["fieldName"]
  arguments = event["arguments"]

  case field_name
  when "createDomain"
    handle_create_domain(event)
  when "createGroup"
    handle_create_group(arguments)
  when "dissolveGroup"
    handle_dissolve_group(arguments)
  when "leaveGroup"
    handle_leave_group(arguments)
  when "recordEventsByNode"
    handle_record_events(arguments)
  else
    raise StandardError, "Unknown field: #{field_name}"
  end
  # NOTE: エラーはAppSyncに伝播させる（rescue しない）
  # AppSyncが自動的にGraphQLエラーに変換する
end

def handle_record_events(arguments)
  # DynamoDBクライアントとリポジトリの初期化
  dynamodb = Aws::DynamoDB::Client.new(region: ENV["AWS_REGION"] || "ap-northeast-1")
  repository = DynamoDBRepository.new(dynamodb)

  # ユースケースの実行
  use_case = RecordEventsUseCase.new(repository)
  result = use_case.execute(
    group_id: arguments["groupId"],
    domain: arguments["domain"],
    node_id: arguments["nodeId"],
    events: arguments["events"],
    ttl_seconds: (ENV["MESH_EVENT_TTL_SECONDS"] || "10").to_i
  )

  # エラーハンドリング
  raise StandardError, result[:error] unless result[:success]

  # AppSync形式にフォーマット
  {
    groupId: result[:groupId],
    domain: result[:domain],
    recordedCount: result[:recordedCount],
    nextSince: result[:nextSince]
  }
end

def handle_create_group(arguments)
  # DynamoDBクライアントとリポジトリの初期化
  dynamodb = Aws::DynamoDB::Client.new(region: ENV["AWS_REGION"] || "ap-northeast-1")
  repository = DynamoDBRepository.new(dynamodb)

  # ユースケースの実行
  use_case = CreateGroupUseCase.new(repository)
  group = use_case.execute(
    name: arguments["name"],
    host_id: arguments["hostId"],
    domain: arguments["domain"],
    use_websocket: arguments.key?("useWebSocket") ? arguments["useWebSocket"] : true
  )

  # AppSync形式にフォーマット
  format_group_response(group)
end

def handle_dissolve_group(arguments)
  # DynamoDBクライアントとリポジトリの初期化
  dynamodb = Aws::DynamoDB::Client.new(region: ENV["AWS_REGION"] || "ap-northeast-1")
  repository = DynamoDBRepository.new(dynamodb)

  # ユースケースの実行
  use_case = DissolveGroupUseCase.new(repository)
  result = use_case.execute(
    group_id: arguments["groupId"],
    domain: arguments["domain"],
    host_id: arguments["hostId"]
  )

  # AppSync形式にフォーマット
  format_dissolve_group_response(result)
end

def handle_leave_group(arguments)
  # DynamoDBクライアントとリポジトリの初期化
  dynamodb = Aws::DynamoDB::Client.new(region: ENV["AWS_REGION"] || "ap-northeast-1")
  repository = DynamoDBRepository.new(dynamodb)

  # ユースケースの実行
  use_case = LeaveGroupUseCase.new(repository)
  result = use_case.execute(
    group_id: arguments["groupId"],
    domain: arguments["domain"],
    peer_id: arguments["nodeId"]
  )

  # エラーハンドリング
  raise StandardError, result[:error] unless result[:success]

  # AppSync形式にフォーマット
  format_leave_group_response(result)
end

def handle_create_domain(event)
  # AppSync + API Key の場合、identity.sourceIp は空になることがある
  # そのため、X-Forwarded-For ヘッダーから取得を試みる
  headers = event.dig("request", "headers") || {}
  x_forwarded_for = headers["x-forwarded-for"]

  source_ip = if x_forwarded_for
    # X-Forwarded-For は "client, proxy1, proxy2" 形式なので最初の要素を取得
    x_forwarded_for.split(",").first.strip
  else
    # fallback: identity.sourceIp (IAM認証などでは設定される)
    event.dig("identity", "sourceIp")&.first
  end

  use_case = CreateDomainUseCase.new
  use_case.execute(source_ip: source_ip)
end

def format_group_response(group)
  {
    id: group.id,
    domain: group.domain,
    fullId: group.full_id,
    name: group.name,
    hostId: group.host_id,
    createdAt: group.created_at,
    useWebSocket: group.use_websocket,
    pollingIntervalSeconds: group.polling_interval_seconds
  }
end

def format_dissolve_group_response(result)
  {
    groupId: result[:groupId],
    domain: result[:domain],
    nodeStatus: nil,
    batchEvent: nil,
    groupDissolve: {
      groupId: result[:groupId],
      domain: result[:domain],
      message: result[:message]
    }
  }
end

def format_leave_group_response(result)
  {
    peerId: result[:peer_id],
    groupId: result[:group_id],
    domain: result[:domain],
    message: result[:message]
  }
end
