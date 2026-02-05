const fs = require('fs');

// 変換したいPNGファイルへのパス
const filePath = process.argv[2];

try {
    // 1. ファイルを同期的にバイナリデータとして読み込む
    const fileData = fs.readFileSync(filePath);

    // 2. Bufferを使用してBase64文字列に変換する
    const base64String = Buffer.from(fileData).toString('base64');

    // 3. Data URIスキームを付加して完成させる
    const dataUri = `data:image/png;base64,${base64String}`;

    console.log(dataUri);

    // （例）HTMLのimgタグに埋め込む場合
    // console.log(`<img src="${dataUri}" alt="Encoded Image">`);

} catch (error) {
    console.error('ファイルの読み込み中にエラーが発生しました:', error);
}
