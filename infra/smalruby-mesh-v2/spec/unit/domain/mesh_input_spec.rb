require "spec_helper"
require_relative "../../../lambda/domain/mesh_input"

# issue #1267: サーバー側の入力上限（ID・グループ名の長さと文字）
RSpec.describe MeshInput do
  let(:hex_id) { "0123456789abcdef0123456789abcdef" }

  describe ".validate_id!" do
    it "今のクライアントの ID（32 桁 16 進）を通す" do
      expect { described_class.validate_id!(hex_id, "nodeId") }.not_to raise_error
    end

    it "出席番号付きの ID（…s07 / …s123）を通す" do
      expect { described_class.validate_id!("#{hex_id}s07", "nodeId") }.not_to raise_error
      expect { described_class.validate_id!("#{hex_id}s123", "nodeId") }.not_to raise_error
    end

    it "ハイフン・アンダースコア入りの ID（旧形式・テスト用）を通す" do
      expect { described_class.validate_id!("host-001_a", "hostId") }.not_to raise_error
    end

    it "128 文字ちょうどは通す" do
      expect { described_class.validate_id!("a" * 128, "nodeId") }.not_to raise_error
    end

    it "129 文字以上は ValidationError" do
      expect { described_class.validate_id!("a" * 129, "nodeId") }
        .to raise_error(MeshInput::ValidationError, /nodeId must be 128 characters or less/)
    end

    it "空・nil は ValidationError" do
      expect { described_class.validate_id!("", "hostId") }
        .to raise_error(MeshInput::ValidationError, /hostId is required/)
      expect { described_class.validate_id!(nil, "hostId") }
        .to raise_error(MeshInput::ValidationError, /hostId is required/)
    end

    ["#", "|", " ", "@", "あ", "\n", "a/b"].each do |bad|
      it "使えない文字（#{bad.inspect}）は ValidationError" do
        expect { described_class.validate_id!("node#{bad}1", "nodeId") }
          .to raise_error(MeshInput::ValidationError, /nodeId contains invalid characters/)
      end
    end

    it "ValidationError は ArgumentError の一種（既存の rescue / 期待と互換）" do
      expect(MeshInput::ValidationError.ancestors).to include(ArgumentError)
    end
  end

  describe ".validate_group_name!" do
    [
      "0123456789abcdef0123456789abcdef",
      "0123456789abcdef0123456789abcdef|host=7",
      "0123456789abcdef0123456789abcdef|host=teacher",
      "0123456789abcdef0123456789abcdef|seats=3,7,12|host=3",
      "Test Group",
      "テストグループ"
    ].each do |name|
      it "今のクライアントの名前（#{name}）を通す" do
        expect { described_class.validate_group_name!(name) }.not_to raise_error
      end
    end

    it "1024 文字ちょうどは通す" do
      expect { described_class.validate_group_name!("a" * 1024) }.not_to raise_error
    end

    it "1025 文字以上は ValidationError" do
      expect { described_class.validate_group_name!("a" * 1025) }
        .to raise_error(MeshInput::ValidationError, /name must be 1024 characters or less/)
    end

    it "空・nil は ValidationError" do
      expect { described_class.validate_group_name!("") }
        .to raise_error(MeshInput::ValidationError, /name is required/)
      expect { described_class.validate_group_name!(nil) }
        .to raise_error(MeshInput::ValidationError, /name is required/)
    end

    ["\u0000", "\n", "\t", "\u001f", "\u007f"].each do |ctrl|
      it "制御文字（#{ctrl.inspect}）は ValidationError" do
        expect { described_class.validate_group_name!("group#{ctrl}name") }
          .to raise_error(MeshInput::ValidationError, /name contains control characters/)
      end
    end
  end
end
