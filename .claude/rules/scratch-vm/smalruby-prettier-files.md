# Smalruby-specific Prettier Target Files (scratch-vm)

Prettier はこのリストに含まれる Smalruby 固有ファイルにのみ適用される。
upstream (Scratch) ファイルは対象外。

**重要**: 新しい Smalruby 固有ファイルを追加した場合は、必ず以下の両方を更新すること:
1. このファイル（一覧に追加）
2. `packages/scratch-vm/.prettierignore`（ホワイトリストに追加）

## ファイル一覧

### src/

**Smalruby 固有ディレクトリ（ディレクトリ内の全ファイルが対象）:**
- `src/extensions/koshien/`
- `src/extensions/microbitMore/`
- `src/extensions/scratch3_g2s/`
- `src/extensions/scratch3_mesh_v2/`
- `src/extensions/scratch3_mesh/`
- `src/extensions/scratch3_smalrubot_s1/`
- `src/extensions/scratch3_tm2scratch/`
- `src/extensions/smalruby_ruby/`

**個別ファイル:**
- `src/extension-support/smalruby-extensions.js`
- `src/serialization/smalruby-migration.js`
- `src/util/debug-logger.js`

### test/

**Smalruby 固有ディレクトリ:**
- `test/load-test/`
- `test/unit/extensions/scratch3_mesh_v2/`

**個別ファイル:**
- `test/integration/extensions/mesh-v1-migration.test.js`
- `test/integration/extensions/mesh-v2-data-merge.test.js`
- `test/integration/extensions/mesh-v2-variable-sync.test.js`
- `test/unit/blocks_operators_regex.js`
- `test/unit/extension_koshien.js`
- `test/unit/extension_mesh_v2_delta_repro.js`
- `test/unit/extension_mesh_v2_delta.js`
- `test/unit/extension_mesh_v2_domain.js`
- `test/unit/extension_mesh_v2_integration.js`
- `test/unit/extension_mesh_v2_issue66.js`
- `test/unit/extension_mesh_v2_service.js`
- `test/unit/extension_mesh_v2.js`
- `test/unit/extension_smalrubot_s1.js`
- `test/unit/mesh_service_v2_cost.js`
- `test/unit/mesh_service_v2_global_vars.js`
- `test/unit/mesh_service_v2_integration.js`
- `test/unit/mesh_service_v2_order.js`
- `test/unit/mesh_service_v2_order_key.js`
- `test/unit/mesh_service_v2_poll_group_data.js`
- `test/unit/mesh_service_v2_polling.js`
- `test/unit/mesh_service_v2_subscription.js`
- `test/unit/mesh_service_v2_timestamp.js`
- `test/unit/mesh_service_v2.js`
- `test/unit/rate_limiter.js`
- `test/unit/scratch3_mesh_v2_rate_limiter_repro.js`
- `test/unit/smalruby_migration.js`
