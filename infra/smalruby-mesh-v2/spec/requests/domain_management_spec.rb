require "spec_helper"

RSpec.describe "Domain Management API", type: :request do
  describe "createDomain mutation" do
    it "ドメインを生成して取得できる" do
      query = File.read(File.join(__dir__, "../fixtures/mutations/create_domain.graphql"))
      response = execute_graphql(query)

      expect(response["errors"]).to be_nil
      domain = response["data"]["createDomain"]
      expect(domain).to be_present
      # 16進数の文字列であることを確認（CRC32ハッシュの結果）
      expect(domain).to match(/\A[0-9a-f]+\z/)
    end

    it "複数回呼び出してもドメインが取得できる（ソースIPが同じなら同じ結果になるはずだが、IPは環境に依存する）" do
      query = File.read(File.join(__dir__, "../fixtures/mutations/create_domain.graphql"))

      response1 = execute_graphql(query)
      expect(response1["errors"]).to be_nil
      domain1 = response1["data"]["createDomain"]

      response2 = execute_graphql(query)
      expect(response2["errors"]).to be_nil
      domain2 = response2["data"]["createDomain"]

      expect(domain1).to eq(domain2)
    end
  end
end
