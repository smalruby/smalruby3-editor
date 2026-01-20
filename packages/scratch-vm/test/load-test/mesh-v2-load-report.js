const fs = require('fs');

/**
 * Generate report.
 * @param {string} inputPath - Path to results JSON file.
 * @param {string} outputPath - Path to output Markdown file.
 * @returns {Promise<void>} - Completion.
 */
const generateReport = async function (inputPath, outputPath) {
    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        return;
    }

    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

    // For now, we'll just generate a Markdown report as a placeholder for the HTML/Chart.js report.
    // The user can extend this to generate HTML.

    const report = `
# MESH v2 負荷テストレポート
生成日時: ${new Date().toLocaleString()}

## サマリー
- テスト期間: ${data.summary.durationSeconds.toFixed(1)} 秒
- 総リクエスト数: ${data.summary.totalRequests}
- 成功数: ${data.summary.successCount}
- エラー数: ${data.summary.errorCount}
- エラー率: ${data.summary.errorRate}
- スループット: ${data.summary.tps} TPS

## レテンシ (ms)
- 平均: ${data.latency.avg}
- P50: ${data.latency.p50}
- P95: ${data.latency.p95}
- P99: ${data.latency.p99}
- 最大: ${data.latency.max}

## イベント配信
- 配信済み数: ${data.events.delivered}
- 平均配信遅延: ${data.events.avgDeliveryDelay} ms

## クロストーク
- 検出数: ${data.crosstalk.count}
${data.crosstalk.count > 0 ? `
### 詳細
${JSON.stringify(data.crosstalk.details, null, 2)}` : ''}
`;

    fs.writeFileSync(outputPath, report);
    console.log(`Report generated: ${outputPath}`);

    await Promise.resolve(); // satisfy require-await
};

/**
 * Main function.
 * @returns {Promise<void>} - Completion.
 */
const main = async function () {
    const args = process.argv.slice(2);
    const inputArg = args.find(a => a.startsWith('--input='));
    const inputPath = inputArg ? inputArg.split('=')[1] : null;

    if (!inputPath) {
        console.error('Usage: node mesh-v2-load-report.js --input=results.json');
        process.exit(1);
    }

    const outputPath = inputPath.replace('.json', '.md');
    await generateReport(inputPath, outputPath);
};

if (require.main === module) {
    main().catch(console.error);
}
