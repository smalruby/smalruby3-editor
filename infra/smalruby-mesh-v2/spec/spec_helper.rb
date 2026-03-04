require "json"
require "net/http"
require "uri"
require "date"
require "securerandom"

# Load support files
Dir[File.join(__dir__, "support", "**", "*.rb")].each { |f| require f }

RSpec.configure do |config|
  config.before(:suite) do
    # 環境変数チェック（結合テストのみ）
    if RSpec.configuration.files_to_run.any? { |f| f.include?("spec/requests/") }
      raise "APPSYNC_ENDPOINT is not set" unless ENV["APPSYNC_ENDPOINT"]
      raise "APPSYNC_API_KEY is not set" unless ENV["APPSYNC_API_KEY"]
    end
  end

  # RSpecの設定
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  config.shared_context_metadata_behavior = :apply_to_host_groups
end

# GraphQL APIを実行するヘルパーメソッド
def execute_graphql(query, variables = {}, suppress_errors: false)
  uri = URI(ENV["APPSYNC_ENDPOINT"])
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  # テスト環境では証明書検証を無効化（AppSyncは信頼できるAWSサービス）
  http.verify_mode = OpenSSL::SSL::VERIFY_NONE

  request = Net::HTTP::Post.new(uri.path, {
    "Content-Type" => "application/json",
    "x-api-key" => ENV["APPSYNC_API_KEY"]
  })

  request.body = JSON.generate({
    query: query,
    variables: variables
  })

  response = http.request(request)
  response_body = JSON.parse(response.body)
  if response_body["errors"] && !suppress_errors
    puts "GraphQL Errors: #{response_body["errors"].inspect}"
  end
  response_body
end

# テスト用グループ作成ヘルパー
def create_test_group(name, host_id, domain, max_connection_time_seconds: nil, use_websocket: true)
  query = File.read(File.join(__dir__, "fixtures/mutations/create_group.graphql"))
  variables = {
    name: name,
    hostId: host_id,
    domain: domain,
    useWebSocket: use_websocket
  }
  variables[:maxConnectionTimeSeconds] = max_connection_time_seconds if max_connection_time_seconds

  response = execute_graphql(query, variables)
  response["data"]["createGroup"]
end

# テスト用ノード参加ヘルパー
def join_test_node(group_id, domain, node_id)
  query = File.read(File.join(__dir__, "fixtures/mutations/join_group.graphql"))
  response = execute_graphql(query, {groupId: group_id, domain: domain, nodeId: node_id})

  # エラーチェック
  if response["errors"]
    raise "GraphQL Error in joinGroup: #{response["errors"].inspect}"
  end

  if response["data"].nil?
    raise "No data in response: #{response.inspect}"
  end

  response["data"]["joinGroup"]
end

# カスタムマッチャー: ISO8601形式の日時文字列か確認
RSpec::Matchers.define :match_iso8601 do
  match do |actual|
    DateTime.iso8601(actual)
    true
  rescue ArgumentError
    false
  end

  failure_message do |actual|
    "expected #{actual} to be a valid ISO8601 datetime string"
  end
end

# カスタムマッチャー: 値が存在するか確認（nil, 空文字でない）
RSpec::Matchers.define :be_present do
  match do |actual|
    !actual.nil? && !actual.to_s.empty?
  end

  failure_message do |actual|
    "expected #{actual.inspect} to be present (not nil or empty)"
  end
end
