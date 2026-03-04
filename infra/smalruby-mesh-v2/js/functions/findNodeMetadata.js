// findNodeMetadata Pipeline Function
// nodeIdから所属しているグループとドメインを特定する

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { nodeId } = ctx.args;

  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({
      pk: `NODE#${nodeId}`,
      sk: 'METADATA'
    })
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  const result = ctx.result;
  const nowEpoch = Math.floor(util.time.nowEpochMilliSeconds() / 1000);

  if (!result || (result.ttl && result.ttl <= nowEpoch)) {
    return null;
  }

  // stashに保存して次のFunctionへ
  ctx.stash.nodeMetadata = result;
  return result;
}
