module.exports = {
    extends: ['@commitlint/config-conventional'],
    ignores: [
        message => message.startsWith('chore(release):'),
        // Dependabot の本文はリリースノートの長い行を含み body-max-line-length に必ず掛かる。
        // 人が trailer だけ真似てすり抜けないよう、件名の形も合わせて見る
        message =>
            /^ci(\(deps\))?: bump /.test(message) &&
            /^Signed-off-by: dependabot\[bot\]/m.test(message)
    ]
};
