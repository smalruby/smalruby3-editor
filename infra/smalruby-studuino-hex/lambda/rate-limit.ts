/**
 * IP ごとの回数を DynamoDB で数える（固定窓・I/O・#2209）。
 *
 * DynamoDB が使えないときは数えずに通す（fail-open。rubytee-relay と同じ。
 * `.claude/rules/infra/development.md` の「混雑・障害時の劣化」）。通したことは計測のログに残す。
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { RateWindow } from './policy';

let docClient: DynamoDBDocumentClient | undefined;
const client = (): DynamoDBDocumentClient => {
  if (!docClient) docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  return docClient;
};

/**
 * 各窓の数を 1 つ増やして、増やしたあとの数を返す。
 * @param tableName - 表の名前
 * @param windows - 窓
 * @returns 各窓の数（数えられなかった窓は undefined）
 */
export const incrementWindows = async (
  tableName: string,
  windows: RateWindow[],
): Promise<(number | undefined)[]> =>
  Promise.all(
    windows.map(async w => {
      try {
        const res = await client().send(
          new UpdateCommand({
            TableName: tableName,
            Key: { key: w.key },
            UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :one, #ttl = :ttl',
            ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
            ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':ttl': w.resetAt },
            ReturnValues: 'UPDATED_NEW',
          }),
        );
        return res.Attributes?.count as number | undefined;
      } catch (err) {
        console.error('[RateLimit] DynamoDB error, failing open:', err);
        return undefined;
      }
    }),
  );
