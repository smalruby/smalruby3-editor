module.exports = {
    extends: ['@commitlint/config-conventional'],
    ignores: [
        message => message.startsWith('chore(release):'),
        // Dependabot の本文はリリースノートの長い行を含み body-max-line-length に必ず掛かる
        message => /^Signed-off-by: dependabot\[bot\]/m.test(message)
    ]
};
