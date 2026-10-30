import * as fs from 'fs';
import * as path from 'path';
import * as appsync from 'aws-cdk-lib/aws-appsync';

const MESH_INPUT_VALIDATION_PATH = path.join(__dirname, '../js/shared/meshInputValidation.js');

/**
 * AppSync JS Function のソースに入力検査（js/shared/meshInputValidation.js）を連結した文字列を返す。
 *
 * APPSYNC_JS は Function 間で import できないため、共通の検査はビルド時に連結して 1 つのソースにする
 * (issue #1267)。検査の関数宣言は巻き上げられるので、本体の末尾に置いてよい。
 */
export function meshInputValidatedSource(functionPath: string): string {
  const body = fs.readFileSync(functionPath, 'utf8');
  const validation = fs.readFileSync(MESH_INPUT_VALIDATION_PATH, 'utf8');
  return `${body}\n${validation}`;
}

export function withMeshInputValidation(functionPath: string): appsync.Code {
  return appsync.Code.fromInline(meshInputValidatedSource(functionPath));
}
