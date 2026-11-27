'use strict';
/**
 * blocked-handler.js — 1 つの worker が blocked（許可・確認・選択のプロンプト）になったときの扱い（#2387）。
 *
 * runner の見回りから呼ばれ、画面を読んで答えるか、一時停止して人間を待つ。判断は blocked.js の
 * 純粋関数、ここは送る・判定を呼ぶ・置き場（blocked-hub.js）に出す I/O だけ。
 * 一時停止しているあいだの時間は {@link pausedMs} で数え、runner が watchdog の経過から引く
 * （人間を待つあいだ 60 分の上限を進めない）。
 */

const { spawn } = require('child_process');
const os = require('os');
const {
    classifyBlockedScreen, decideBlocked, parseJudgeReply, judgePrompt, screenSignature,
} = require('./blocked');

/**
 * 安い `claude -p` で画面を判定する（既定の judge）。CLAUDE.md などを読ませないよう tmpdir で動かす。
 * @param {string} screen
 * @param {object} t resolveTerminalSettings の結果（judgeModel / judgeTimeoutMs）
 * @returns {Promise<string>} 出力
 */
function claudeJudge(screen, t) {
    return new Promise((resolve, reject) => {
        const child = spawn('claude', ['-p', '--model', t.judgeModel, judgePrompt()], {
            cwd: os.tmpdir(), stdio: ['pipe', 'pipe', 'ignore'],
        });
        let out = '';
        const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('judge timeout')); }, t.judgeTimeoutMs);
        child.stdout.on('data', (d) => { out += d; });
        child.on('error', (e) => { clearTimeout(timer); reject(e); });
        child.on('close', () => { clearTimeout(timer); resolve(out); });
        child.stdin.end(String(screen).slice(-6000));
    });
}

/**
 * @param {object} o
 * @param {object} o.term terminal.js の backend
 * @param {string} o.session worker の名前
 * @param {object} o.settings resolveTerminalSettings の結果
 * @param {object} [o.channel] blocked-hub の channel（無ければ人間はモニターから答えられない。herdr に attach して答える）
 * @param {function} [o.judge] (screen) => Promise<string>（テスト用。既定 claudeJudge）
 * @param {function} [o.log]
 * @param {number} [o.cooldownMs] 答えたあと、画面が変わるのを待つ時間
 * @returns {{step:function, pausedMs:function, isPaused:function}}
 */
function createBlockedHandler(o) {
    const log = o.log || (() => {});
    const judge = o.judge || ((screen) => claudeJudge(screen, o.settings));
    const cooldownMs = o.cooldownMs ?? 5_000;
    const answers = new Map(); // 画面の署名 → 答えた回数
    let paused = false;
    let pausedSince = 0;
    let pausedTotal = 0;
    let cooldownUntil = 0;

    const resume = (now, reason) => {
        pausedTotal += now - pausedSince;
        paused = false;
        pausedSince = 0;
        cooldownUntil = now + cooldownMs;
        if (o.channel) o.channel.close(reason);
    };

    /**
     * 見回り 1 回分。
     * @param {object} s
     * @param {boolean} s.blocked 画面がプロンプトで止まっているか
     * @param {string} s.screen 画面
     * @param {number} s.now 時刻（ms）
     * @returns {Promise<{paused:boolean, answered:boolean}>}
     */
    async function step({ blocked, screen, now }) {
        if (paused) {
            const ans = o.channel ? o.channel.take() : null;
            if (ans) {
                if (ans.keys) o.term.sendKeys(o.session, ans.keys);
                else o.term.sendLine(o.session, ans.text);
                answers.clear();
                resume(now, '人間が答えた');
                return { paused: false, answered: true };
            }
            if (!blocked) { resume(now, '画面が進んだ'); return { paused: false, answered: false }; }
            if (o.channel) o.channel.update({ screen });
            return { paused: true, answered: false };
        }
        if (!blocked || now < cooldownUntil) return { paused: false, answered: false };

        const sig = screenSignature(screen);
        const base = {
            classification: classifyBlockedScreen(screen),
            judgeEnabled: !!(o.settings && o.settings.judge),
            sameScreenAnswers: answers.get(sig) || 0,
        };
        let d = decideBlocked(base);
        if (d.action === 'judge') {
            let reply = null;
            try { reply = parseJudgeReply(await judge(screen)); } catch (e) { log(`blocked judge failed: ${e.message}`); }
            d = decideBlocked({ ...base, judge: reply });
        }
        if (d.action === 'answer') {
            o.term.sendKeys(o.session, d.keys);
            answers.set(sig, base.sameScreenAnswers + 1);
            cooldownUntil = now + cooldownMs;
            if (o.channel) o.channel.record({ type: 'answered', source: d.source, keys: d.keys, reason: d.reason });
            else log(`blocked answered (${d.source}) keys=${d.keys.join(' ')} — ${d.reason}`);
            return { paused: false, answered: true };
        }
        paused = true;
        pausedSince = now;
        if (o.channel) {
            o.channel.open({ reason: d.reason, source: d.source, screen, options: base.classification.options });
        } else log(`blocked paused — ${d.reason}`);
        return { paused: true, answered: false };
    }

    return {
        step,
        pausedMs: (now) => pausedTotal + (paused ? now - pausedSince : 0),
        isPaused: () => paused,
    };
}

module.exports = { createBlockedHandler, claudeJudge };
