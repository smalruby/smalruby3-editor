import React from 'react';

import GUI from '../../containers/gui.jsx';

/**
 * 狭幅 viewport 用の独立 GUI シェル (issue #572 Phase 2)。
 *
 * 設計方針:
 * - upstream の <GUI> には手を入れず、別コンポーネントとして並走する
 * - Phase 2-A の段階では中身は <GUI> を素通し (機能・見た目に変化なし)
 * - 後続の PR で順次:
 *   - PR-2B: ボトムタブ × 5 (ブロック / Ruby / スプライト / コスチューム / 音)
 *   - PR-2C: ステージ全画面プレビュー (▶ 起動 + 自動実行、⏹ 停止 + 戻る)
 *   - PR-2D: ブロックパレットドロワー
 *   - PR-2E: ハンバーガーメニュー
 *   をこのコンポーネント内に実装し、徐々に <GUI> から切り離していく。
 *
 * 受け取る props は <GUI> と同一 (AppStateHOC / HashParserHOC からの全 props)。
 * @param {object} props - <GUI> と同じ props
 * @returns {JSX.Element} 現状は <GUI> を素通しでレンダリング
 */
const MobileGui = props => <GUI {...props} />;

export default MobileGui;
