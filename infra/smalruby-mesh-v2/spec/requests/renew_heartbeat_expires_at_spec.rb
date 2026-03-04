require "spec_helper"

RSpec.describe "Heartbeat API - expiresAt consistency", type: :request do
  let(:domain) { "test-heartbeat-consistency-#{Time.now.to_i}.example.com" }
  let(:host_id) { "host-#{Time.now.to_i}" }
  let(:group_name) { "Test Group" }

  it "returns the same expiresAt during renewHeartbeat as createGroup" do
    # 1. Create a group
    create_mutation = <<~GRAPHQL
      mutation CreateGroup($name: String!, $hostId: ID!, $domain: String!, $useWebSocket: Boolean!) {
        createGroup(name: $name, hostId: $hostId, domain: $domain, useWebSocket: $useWebSocket) {
          id
          expiresAt
        }
      }
    GRAPHQL

    create_vars = {
      name: group_name,
      hostId: host_id,
      domain: domain,
      useWebSocket: true
    }

    create_response = execute_graphql(create_mutation, create_vars)
    expect(create_response["data"]["createGroup"]).not_to be_nil

    group_id = create_response["data"]["createGroup"]["id"]
    original_expires_at = create_response["data"]["createGroup"]["expiresAt"]

    expect(group_id).not_to be_nil
    expect(original_expires_at).not_to be_nil

    # 2. Renew heartbeat and check expiresAt
    # We wait a bit to ensure that if it was incorrectly using "now + TTL", it would change
    sleep 2

    renew_mutation = <<~GRAPHQL
      mutation RenewHeartbeat($groupId: ID!, $domain: String!, $hostId: ID!) {
        renewHeartbeat(groupId: $groupId, domain: $domain, hostId: $hostId) {
          groupId
          expiresAt
        }
      }
    GRAPHQL

    renew_vars = {
      groupId: group_id,
      domain: domain,
      hostId: host_id
    }

    renew_response = execute_graphql(renew_mutation, renew_vars)
    expect(renew_response["data"]["renewHeartbeat"]).not_to be_nil

    renewed_expires_at = renew_response["data"]["renewHeartbeat"]["expiresAt"]

    # Check that expiresAt remains unchanged (it should be the group's original expiration time)
    expect(renewed_expires_at).to eq(original_expires_at)
  end
end
