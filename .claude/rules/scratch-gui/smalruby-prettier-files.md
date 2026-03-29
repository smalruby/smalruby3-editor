# Smalruby-specific Prettier Target Files (scratch-gui)

Prettier はこのリストに含まれる Smalruby 固有ファイルにのみ適用される。
upstream (Scratch) ファイルは対象外。

**重要**: 新しい Smalruby 固有ファイルを追加した場合は、必ず以下の両方を更新すること:
1. このファイル（一覧に追加）
2. `packages/scratch-gui/.prettierignore`（ホワイトリストに追加）

## ファイル一覧

### src/components/

**Smalruby 固有ディレクトリ（ディレクトリ内の全ファイルが対象）:**
- `src/components/auto-correct-modal/`
- `src/components/block-display-modal/`
- `src/components/blocks-screenshot-button/`
- `src/components/google-drive-save-dialog/`
- `src/components/koshien-test-modal/`
- `src/components/palette-toggle/`
- `src/components/ruby-script-preview/`
- `src/components/ruby-toolbar/`
- `src/components/rubytee-consent/`
- `src/components/rubytee-modal/`
- `src/components/url-loader-modal/`

**混在ディレクトリ内の個別ファイル:**
- `src/components/connection-modal/mesh-v2-initial-step.css`
- `src/components/connection-modal/mesh-v2-initial-step.jsx`
- `src/components/connection-modal/mesh-v2-network-filtered-step.jsx`
- `src/components/connection-modal/mesh-v2-scanning-step.jsx`
- `src/components/menu-bar/tutorial-tooltip.css`
- `src/components/menu-bar/tutorial-tooltip.jsx`

### src/containers/

**Smalruby 固有ディレクトリ:**
- `src/containers/ruby-tab/`

**個別ファイル:**
- `src/containers/block-display-modal.jsx`
- `src/containers/extension-library.css`
- `src/containers/google-drive-loader-hoc.jsx`
- `src/containers/google-drive-saver-hoc.jsx`
- `src/containers/ruby-downloader.jsx`
- `src/containers/ruby-tab.jsx`
- `src/containers/rubytee-modal-hoc.jsx`

### src/lib/

**Smalruby 固有ディレクトリ:**
- `src/lib/dncl/`
- `src/lib/ruby-generator/`
- `src/lib/ruby-to-blocks-converter/`
- `src/lib/settings/`
- `src/lib/themes/`
- `src/lib/libraries/extensions/koshien/`
- `src/lib/libraries/extensions/microbitMore/`
- `src/lib/libraries/extensions/smalruby-ruby/`

**個別ファイル:**
- `src/lib/auto-correct.js`
- `src/lib/block-utils.js`
- `src/lib/blocks-gesture-recovery.js`
- `src/lib/blocks-screenshot.js`
- `src/lib/define-ruby-blocks.js`
- `src/lib/furigana-annotator.js`
- `src/lib/furigana-call-helpers.js`
- `src/lib/furigana-extension-handlers.js`
- `src/lib/furigana-label-map.js`
- `src/lib/furigana-node-handlers.js`
- `src/lib/generator.js`
- `src/lib/google-drive-api.js`
- `src/lib/google-script-loader.js`
- `src/lib/insert-class.js`
- `src/lib/log-suppression.js`
- `src/lib/microbit-more-update.js`
- `src/lib/module-sync.js`
- `src/lib/monaco-i18n-helper.js`
- `src/lib/prism-parser.js`
- `src/lib/project-loader-utils.js`
- `src/lib/radix-ui-context-menu.js`
- `src/lib/ruby-parser.js`
- `src/lib/ruby-screenshot.js`
- `src/lib/ruby-script-preview.js`
- `src/lib/ruby-to-blocks-converter-hoc.jsx`
- `src/lib/rubytee-api.js`
- `src/lib/rubytee-context.js`
- `src/lib/url-loader-hoc.jsx`
- `src/lib/url-params.js`
- `src/lib/url-parser.js`
- `src/lib/version-checker.js`

### src/locales/

- `src/locales/en.js`
- `src/locales/index.js`
- `src/locales/ja-Hira.js`
- `src/locales/ja.js`

### src/reducers/

- `src/reducers/block-display.js`
- `src/reducers/dncl-mode.js`
- `src/reducers/extension-filter.js`
- `src/reducers/google-drive-file.js`
- `src/reducers/koshien-file.js`
- `src/reducers/mesh-v2.js`
- `src/reducers/palette-visibility.js`
- `src/reducers/ruby-code.js`
- `src/reducers/smalruby-registry.ts`
- `src/reducers/tutorial-onboarding.js`

### test/

**Smalruby 固有ディレクトリ:**
- `test/helpers/`
- `test/unit/containers/ruby-tab/`
- `test/unit/helpers/`
- `test/unit/lib/dncl/`
- `test/unit/lib/ruby-generator/`
- `test/unit/lib/ruby-roundtrip/`
- `test/unit/lib/ruby-to-blocks-converter/`

**個別ファイル:**
- `test/__mocks__/browserWasiShimMock.js`
- `test/integration/auto-correct.test.js`
- `test/integration/block-display-modal.test.js`
- `test/integration/block-palette.test.js`
- `test/integration/debug_defaults.test.js`
- `test/integration/dncl-mode-validation.test.js`
- `test/integration/feedback-link.test.js`
- `test/integration/ruby-editor-actions.test.js`
- `test/integration/ruby-module.test.js`
- `test/integration/ruby-script-preview.test.js`
- `test/integration/ruby-super.test.js`
- `test/integration/ruby-tab-completion-and-indent.test.js`
- `test/integration/ruby-tab-furigana-zoom.test.js`
- `test/integration/ruby-tab.test.js`
- `test/integration/rubytee-consent.test.js`
- `test/integration/smalruby-tutorials.test.js`
- `test/integration/v1-detection-prompt.test.js`
- `test/integration/version-update-notification.test.js`
- `test/unit/components/action-menu.test.jsx`
- `test/unit/components/connected-step.test.jsx`
- `test/unit/components/palette-toggle.test.jsx`
- `test/unit/components/project-title-input.test.jsx`
- `test/unit/components/scanning-step-name-search.test.js`
- `test/unit/containers/backpack.test.jsx`
- `test/unit/containers/cards.test.jsx`
- `test/unit/containers/connection-modal-connected-message.test.jsx`
- `test/unit/containers/connection-modal.test.jsx`
- `test/unit/containers/google-drive-saver-hoc.test.jsx`
- `test/unit/containers/google-drive-state-management.test.jsx`
- `test/unit/containers/ruby-downloader.test.jsx`
- `test/unit/containers/ruby-tab-project-changed.test.js`
- `test/unit/containers/rubytee-modal-hoc-sanitize.test.js`
- `test/unit/empty-block-selection.test.js`
- `test/unit/lib/auto-correct.test.js`
- `test/unit/lib/backpack-api.test.js`
- `test/unit/lib/block-display-initialization.test.js`
- `test/unit/lib/blocks-gesture-recovery.test.js`
- `test/unit/lib/blocks-screenshot.test.js`
- `test/unit/lib/furigana-annotator-perf.test.js`
- `test/unit/lib/furigana-annotator.test.js`
- `test/unit/lib/google-drive-api.test.js`
- `test/unit/lib/insert-class.test.js`
- `test/unit/lib/layout-constants.test.js`
- `test/unit/lib/legacy-storage.test.js`
- `test/unit/lib/make-toolbox-xml.test.js`
- `test/unit/lib/module-sync.test.js`
- `test/unit/lib/prism-parser.test.js`
- `test/unit/lib/removed-trademarks.test.js`
- `test/unit/lib/ruby-generator-procedure-arguments.test.js`
- `test/unit/lib/ruby-generator-version.test.jsx`
- `test/unit/lib/ruby-roundtrip-class-assets.test.js`
- `test/unit/lib/ruby-roundtrip-class-stage.test.js`
- `test/unit/lib/ruby-roundtrip-class-superclass.test.js`
- `test/unit/lib/ruby-roundtrip-comment-bugs.test.js`
- `test/unit/lib/ruby-roundtrip-gets.test.js`
- `test/unit/lib/ruby-roundtrip-method-return.test.js`
- `test/unit/lib/ruby-roundtrip-super.test.js`
- `test/unit/lib/ruby-screenshot.test.js`
- `test/unit/lib/ruby-script-preview.test.js`
- `test/unit/lib/ruby-to-blocks-converter-version.test.js`
- `test/unit/lib/rubytee-api.test.js`
- `test/unit/lib/rubytee-context.test.js`
- `test/unit/lib/screen-utils.test.js`
- `test/unit/lib/setup-prism.js`
- `test/unit/lib/version-checker.test.js`
- `test/unit/make-toolbox-xml-exact-match.test.js`
- `test/unit/make-toolbox-xml-hex.test.js`
- `test/unit/only-blocks-initialization.test.js`
- `test/unit/reducers/cards_reducer.test.js`
- `test/unit/reducers/menus-reducer.test.js`
- `test/unit/reducers/palette-visibility-reducer.test.js`
- `test/unit/reducers/settings.test.js`
- `test/unit/reducers/stage-size-reducer.test.js`
- `test/unit/setup.js`
- `test/unit/util/ruby-versions.test.js`
