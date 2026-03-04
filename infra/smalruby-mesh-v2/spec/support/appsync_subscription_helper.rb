require "faye/websocket"
require "eventmachine"
require "json"
require "securerandom"
require "base64"

# AppSync WebSocket Subscription Helper
# AppSyncのリアルタイムエンドポイントに接続してSubscriptionをテストするヘルパー
class AppSyncSubscriptionHelper
  class SubscriptionError < StandardError; end
  class TimeoutError < SubscriptionError; end

  attr_reader :endpoint, :api_key, :ws_endpoint

  def initialize(endpoint, api_key)
    @endpoint = endpoint
    @api_key = api_key
    @ws_endpoint = convert_to_websocket_endpoint(endpoint)
    @host = extract_host(endpoint)
  end

  # Subscriptionを確立し、mutationを実行し、データ受信を待つ
  # @param query [String] GraphQL subscription query
  # @param variables [Hash] Subscription variables
  # @param wait_time [Integer] Time to wait before executing block (seconds)
  # @param timeout [Integer] Total timeout (seconds)
  # @yield Block to execute after subscription is established (e.g., mutation)
  # @return [Array<Hash>] All received subscription data
  def subscribe_and_execute(query, variables = {}, wait_time: 2, timeout: 15, &block)
    received_data = []
    error = nil
    subscription_id = SecureRandom.uuid
    subscription_ready = false
    block_executed = false

    EM.run do
      # Timeout timer
      timeout_timer = EM.add_timer(timeout) do
        puts "[Timeout] No data received after #{timeout}s"
        EM.stop
      end

      # WebSocket connection
      ws = create_websocket_connection

      ws.on :open do
        puts "[Subscription] WebSocket connection established"
        send_message(ws, type: "connection_init")
      end

      ws.on :message do |event|
        message = JSON.parse(event.data)
        msg_type = message["type"]

        case msg_type
        when "connection_ack"
          puts "[Subscription] Connection acknowledged"
          # Start subscription
          send_message(ws, {
            id: subscription_id,
            type: "start",
            payload: {
              data: JSON.generate({
                query: query,
                variables: variables
              }),
              extensions: {
                authorization: {
                  host: @host,
                  "x-api-key": @api_key
                }
              }
            }
          })

        when "start_ack"
          puts "[Subscription] Subscription started, waiting #{wait_time}s before executing mutation..."
          subscription_ready = true

          # Wait before executing block
          EM.add_timer(wait_time) do
            unless block_executed
              block_executed = true
              begin
                block.call if block_given?
              rescue => e
                error = e
                puts "[Error] Mutation block failed: #{e.message}"
              end
            end
          end

        when "data"
          data = message.dig("payload", "data")
          if data
            puts "[Subscription] Data received!"
            received_data << data

            # Stop after receiving data
            EM.add_timer(1) do
              EM.cancel_timer(timeout_timer) if timeout_timer
              EM.stop
            end
          end

        when "error"
          error_msg = message["payload"]
          puts "[Subscription] Error: #{error_msg}"
          error = SubscriptionError.new("Subscription error: #{error_msg}")

        when "ka"
          # Keep-alive (silent)
        end
      end

      ws.on :error do |event|
        puts "[Subscription] WebSocket error: #{event.message}"
        error = SubscriptionError.new("WebSocket error: #{event.message}")
      end

      ws.on :close do |event|
        puts "[Subscription] Connection closed (received #{received_data.length} message(s))"
        EM.cancel_timer(timeout_timer) if timeout_timer
        EM.stop
      end
    end

    raise error if error
    received_data
  end

  private

  def convert_to_websocket_endpoint(https_endpoint)
    if https_endpoint.include?(".appsync-api.")
      https_endpoint
        .sub("https://", "wss://")
        .sub(".appsync-api.", ".appsync-realtime-api.")
    else
      # For custom domains, AppSync WebSocket endpoint requires /realtime path
      https_endpoint
        .sub("https://", "wss://")
        .sub(/\/graphql\/?$/, "/graphql/realtime")
    end
  end

  def extract_host(endpoint)
    URI.parse(endpoint).host
  end

  def create_websocket_connection
    # Encode authorization header for AppSync WebSocket
    header = Base64.strict_encode64(JSON.generate({
      "host" => @host,
      "x-api-key" => @api_key
    }))
    payload = Base64.strict_encode64("{}")

    # Build WebSocket URL with authentication
    ws_url_with_auth = "#{@ws_endpoint}?header=#{header}&payload=#{payload}"

    Faye::WebSocket::Client.new(ws_url_with_auth, ["graphql-ws"])
  end

  def send_message(ws, message)
    ws.send(JSON.generate(message))
  end
end
