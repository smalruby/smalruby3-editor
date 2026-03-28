/**
 * Smalruby state context for Rubytee AI assistant
 *
 * Provides helper to build the state context section describing the current
 * sprite/stage state. This is sent to smalruby-rubytee-relay as structured JSON
 * (stateContext), where the relay builds the full system prompt (in English).
 *
 * Note: The full system instruction (Smalruby language spec, guidelines, etc.)
 * is managed by infra/smalruby-rubytee-relay, not here. This file only manages
 * the state context format for the current sprite/stage/vm state.
 */

/**
 * Build the state section text for the system prompt (used by relay for reference format)
 * @param {object} sprite - Current sprite state
 * @param {object} stage - Stage state
 * @param {object} vm - VM state
 * @returns {string} State section text
 */
const buildStateSection = (sprite, stage, vm) => {
  if (!sprite && !stage && !vm) {
    return ''
  }

  const parts = ['\n## 現在の状態\n']

  if (sprite) {
    parts.push(`### 現在編集中のスプライト: "${sprite.name}"`)
    parts.push(`- 座標: (${sprite.x}, ${sprite.y}), 向き: ${sprite.direction}度, 大きさ: ${sprite.size}%`)

    const costumeNames = (sprite.costumes || []).map(c => c.name)
    parts.push(
      `- コスチューム一覧: ${costumeNames.length > 0 ? costumeNames.map(n => `"${n}"`).join(', ') : '（なし）'}`,
    )
    parts.push('  - **switch_costume() にはこの中の名前のみ指定可能です**')

    const soundNames = (sprite.sounds || []).map(s => s.name)
    parts.push(
      `- サウンド一覧: ${
        soundNames.length > 0
          ? soundNames.map(n => `"${n}"`).join(', ')
          : '（なし — play() / play_until_done() は使えません）'
      }`,
    )
    if (soundNames.length > 0) {
      parts.push('  - **play() / play_until_done() にはこの中の名前のみ指定可能です**')
    }

    if (sprite.currentCode) {
      parts.push(`- 現在のコード:\n\`\`\`ruby\n${sprite.currentCode}\n\`\`\``)
    }
    parts.push('')
  }

  if (stage) {
    parts.push('### ステージ')
    parts.push(`- サイズ: ${stage.width}x${stage.height}`)

    const stageCostumes = (stage.costumes || []).map(c => c.name)
    parts.push(`- 背景一覧: ${stageCostumes.length > 0 ? stageCostumes.map(n => `"${n}"`).join(', ') : '（なし）'}`)
    parts.push('  - **switch_backdrop() / when_backdrop_switches() にはこの中の名前のみ指定可能です**')

    const stageSounds = (stage.sounds || []).map(s => s.name)
    if (stageSounds.length > 0) {
      parts.push(`- ステージのサウンド一覧: ${stageSounds.map(n => `"${n}"`).join(', ')}`)
    }
    parts.push('')
  }

  if (vm && vm.extensions && vm.extensions.length > 0) {
    parts.push(`### 有効な拡張機能: ${vm.extensions.join(', ')}\n`)
  }

  return parts.join('\n')
}

export { buildStateSection }
