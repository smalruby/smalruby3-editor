require "spec_helper"
require "zlib"
require_relative "../../../lambda/use_cases/create_domain"

RSpec.describe CreateDomainUseCase do
  let(:secret_key) { "test-secret-key" }
  let(:use_case) { described_class.new(secret_key: secret_key) }

  describe "#execute" do
    it "ソースIPをCRC32でハッシュ化して16進数で返す" do
      ip = "192.168.1.1"
      expected = Zlib.crc32(secret_key + ip).to_s(16)

      result = use_case.execute(source_ip: ip)
      expect(result).to eq(expected)
    end

    it "source_ipがnilの場合は 'none' を使用してハッシュ化する" do
      expected = Zlib.crc32(secret_key + "none").to_s(16)

      result = use_case.execute(source_ip: nil)
      expect(result).to eq(expected)
    end

    it "異なるIPからは異なるドメインが生成される" do
      result1 = use_case.execute(source_ip: "1.1.1.1")
      result2 = use_case.execute(source_ip: "2.2.2.2")
      expect(result1).not_to eq(result2)
    end
  end
end
