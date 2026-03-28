// === Smalruby: This file is Smalruby-specific (version update notification) ===

const DEFAULT_INITIAL_DELAY_MS = 5000
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Create a version checker that periodically fetches version.json
 * and calls onUpdateAvailable when a new version is detected.
 * @param {object} options
 * @param {string} options.currentCommitId - The commit ID baked into this build.
 * @param {Function} options.onUpdateAvailable - Called when a newer version is found.
 * @param {number} [options.initialDelayMs] - Delay before first check (default 5s).
 * @param {number} [options.intervalMs] - Interval between checks (default 1h).
 * @returns {{start: Function, stop: Function, check: Function}} Version checker controller.
 */
const createVersionChecker = ({
  currentCommitId,
  onUpdateAvailable,
  initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
  intervalMs = DEFAULT_INTERVAL_MS,
}) => {
  let initialTimer = null
  let intervalTimer = null

  const check = async () => {
    if (!currentCommitId) return
    try {
      const response = await fetch('./version.json', { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json()
      if (data.commitId && data.commitId !== currentCommitId) {
        onUpdateAvailable()
      }
    } catch (_e) {
      // Silently ignore fetch errors (e.g. local dev, offline)
    }
  }

  const start = () => {
    initialTimer = setTimeout(() => {
      check()
      intervalTimer = setInterval(check, intervalMs)
    }, initialDelayMs)
  }

  const stop = () => {
    if (initialTimer) {
      clearTimeout(initialTimer)
      initialTimer = null
    }
    if (intervalTimer) {
      clearInterval(intervalTimer)
      intervalTimer = null
    }
  }

  return { start, stop, check }
}

export { createVersionChecker }
