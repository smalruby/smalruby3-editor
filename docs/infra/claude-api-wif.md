# Claude API の Workload Identity Federation（WIF）の設定

smalruby の費用で Claude API を呼ぶ Lambda は、静的な API キーではなく **Workload Identity Federation（WIF）の短期トークン**で呼ぶ。この文書は、その設定を AWS と Claude Console で**手で作り直す**ための手順。stage を足すとき、ロールが作り直されたとき、Console の設定を失ったときに使う。

- 根拠（公式）: [Use WIF with AWS](https://platform.claude.com/docs/en/manage-claude/wif-providers/aws) / [WIF の概念](https://platform.claude.com/docs/en/manage-claude/workload-identity-federation) / [リファレンス](https://platform.claude.com/docs/en/manage-claude/wif-reference)
- 秘密の値はこの文書に書かない。ID や ARN は `<...>` の形で示し、取り出し方のコマンドを添える。

## 対象

| 機能 | Lambda（prod / stg） | プロジェクト |
|---|---|---|
| クラス管理の AI 評価 | `ClassroomHandler` / `ClassroomHandler-stg` | `infra/smalruby-classroom` |
| ルビティーにまかせる（takeover） | `RubyteeRelayTakeoverWorker` / `RubyteeRelayTakeoverWorker-stg` | `infra/smalruby-rubytee-relay` |

relay の受け口（`RubyteeRelayHandler`）は Claude を呼ばない（Ruby タブの旧チャットは止めた）ので対象外。

## 仕組み

1. Lambda が AWS STS の `GetWebIdentityToken` で、自分の実行ロールを名乗る JWT を取る（audience `https://api.anthropic.com`・RS256・300 秒）。
2. Anthropic の TypeScript SDK（`oidcFederationProvider`）が、その JWT を Claude API の短期トークンに交換して使う。交換・キャッシュ・期限前の更新は SDK が行う。
3. Claude Console の **federation rule** が、JWT の `sub`（実行ロールの ARN）と audience を見て、どの service account・workspace のトークンを出すかを決める。

コードは `lambda/anthropic-client.ts`（2 つのプロジェクトに同じ内容のコピー）。次の 4 つの環境変数のうち、rule / organization / service account の 3 つがそろうと WIF で呼ぶ（workspace は任意）。静的な API キーの経路は無い。そろっていなければ Claude を呼ばない（AI 評価は 503、takeover は AI のエラー）。どちらの状態かは、起動時のログ `{"event":"anthropic_auth","mode":"federation" | "none"}` で分かる。WIF の交換に失敗したときは `AI_API_ERROR`。

| 環境変数 | 値の形 | どこで見るか |
|---|---|---|
| `ANTHROPIC_FEDERATION_RULE_ID` | `fdrl_...` | Console の rule |
| `ANTHROPIC_ORGANIZATION_ID` | UUID | Console の Settings → Organization |
| `ANTHROPIC_SERVICE_ACCOUNT_ID` | `svac_...` | Console の service account |
| `ANTHROPIC_WORKSPACE_ID` | `wrkspc_...` | Console の Settings → Workspaces |

## 構成（いまの形）

- **AWS アカウントは stg / prod で同じ**。そのため Outbound web identity federation の有効化も、Console の issuer も 1 つで済む。
- **rule と service account は、Lambda ごとに 1 つずつ（計 4 つ）**作る。名前は両方とも `smalruby-<機能>-<stage>` にそろえる（`smalruby-classroom-stg` / `smalruby-classroom-prod` / `smalruby-rubytee-stg` / `smalruby-rubytee-prod`）。認証履歴で rule 名を見れば、どの Lambda かが分かる。
- **workspace は stage ごとに 1 つ**（「smalruby stg」と「smalruby 本番」）。使用量・上限・課金は workspace 単位で付く。機能ごとの使用量は CloudWatch のログ（`classroom_evaluate` / `rubytee_takeover_response` のトークン数）で見る。機能ごとに支出の上限を分けたくなったら、workspace を分けて rule の向け先を変える。このときコードの変更は要らない（`ANTHROPIC_WORKSPACE_ID` を変えて出し直す）。
- 実行ロールの `sts:GetWebIdentityToken` は、CDK（各スタックの PolicyStatement）で Claude API 向けの JWT だけに絞ってある（`ForAllValues:StringEquals` + `Null` で audience、`sts:SigningAlgorithm` = RS256、`sts:DurationSeconds` ≤ 300）。`anthropic-client.ts` の呼び出しを変えるときは、この条件も合わせる。ずれるとデプロイは通るのに、実行時に STS が拒否する。

## 手順

### 1. AWS: Outbound web identity federation を有効にする（アカウントで 1 回）

AWS コンソールの **IAM → Account settings → Outbound web identity federation** を有効にする。CLI でも同じことができる:

```bash
export AWS_PROFILE=smalruby AWS_REGION=ap-northeast-1
aws iam enable-outbound-web-identity-federation
aws iam get-outbound-web-identity-federation-info   # JwtVendingEnabled が true か / IssuerIdentifier を控える
```

`IssuerIdentifier`（`https://<uuid>.tokens.sts.global.api.aws`）が、次の手順で Console に登録する issuer の URL になる。**末尾にスラッシュを付けず、完全に一致させる**（ずれると交換が `iss` の不一致で失敗する。いちばん多い失敗）。

ロールの権限（`sts:GetWebIdentityToken`）は CDK が付けるので、手で付けない。Console のウィザードの「信頼ポリシーを追加しました」のチェックは、この権限のことを指す。ロールの信頼ポリシー（AssumeRole の相手）を変える必要は無い。付いているかは次で確かめられる:

```bash
aws iam list-role-policies --role-name <role-name>
aws iam get-role-policy --role-name <role-name> --policy-name <policy-name>
```

### 2. 実行ロールの ARN を調べる

rule の `subject_prefix` には、各 Lambda の実行ロールの ARN を**そのまま**書く。CDK が名前の末尾にランダムな文字列を付けるので、毎回 AWS から取る:

```bash
for f in ClassroomHandler-stg ClassroomHandler RubyteeRelayTakeoverWorker-stg RubyteeRelayTakeoverWorker; do
  echo "$f $(aws lambda get-function-configuration --function-name $f --query Role --output text)"
done
```

### 3. Claude Console: rule を作る（Lambda ごとに 1 回）

<https://platform.claude.com/settings/workload-identity-federation> → **Connect workload** → **AWS** を開く。ウィザードは、issuer → service account → federation rule の順に作る。

| 項目 | 値 |
|---|---|
| Issuer | 1 の `IssuerIdentifier`（JWKS は discovery）。2 つ目以降は、作った issuer を選ぶ |
| Service account | `smalruby-<機能>-<stage>` |
| Rule の名前 | service account と同じ |
| IAM ロール ARN（`subject_prefix`） | 2 で調べた ARN。**末尾に `*` を付けない**（付けると前方一致になり、ほかのロールも通る） |
| Audience | `https://api.anthropic.com` |
| Workspace | stage の workspace |
| OAuth scope | `workspace:developer` |
| Token lifetime | 600（ウィザードの初期値） |

ウィザードの最後に出るテスト用のスニペット（`aws sts get-web-identity-token` → `curl .../v1/oauth/token`）は、**手元では実行しない**。手元の AWS の名義（SSO のロール）で JWT を取ると `sub` が rule のロールと合わず、401 になる。確かめるのは手順 6 で、Lambda から実際に呼んで行う。スニペットに出る 4 つの値（rule ID・organization ID・service account ID・workspace ID）を控える。

### 4. 値を入れる

`infra/<project>/.env.<stage>` に 4 つの値を書き足す。`.env.prod` は prod、`.env.stg` は stg。書き足す前にバックアップを取る（`cp .env.stg .env.stg.$(date +%Y%m%d%H%M)`）。

```
ANTHROPIC_FEDERATION_RULE_ID=fdrl_...
ANTHROPIC_ORGANIZATION_ID=<organization-uuid>
ANTHROPIC_SERVICE_ACCOUNT_ID=svac_...
ANTHROPIC_WORKSPACE_ID=wrkspc_...
```

CI はファイルではなく、GitHub の Secrets に入れた `.env` の中身を読む。ファイル全体を入れ直す（`bin/gh-admin` の使い方は `.claude/rules/github-app-bot.md`）:

```bash
# stg（repo の Secrets）
bin/gh-admin secret set INFRA_STG_DOTENV_SMALRUBY_CLASSROOM < infra/smalruby-classroom/.env.stg
bin/gh-admin secret set INFRA_STG_DOTENV_SMALRUBY_RUBYTEE_RELAY < infra/smalruby-rubytee-relay/.env.stg
# prod（Environment prod の Secrets）
bin/gh-admin secret set INFRA_PROD_DOTENV_SMALRUBY_CLASSROOM --env prod < infra/smalruby-classroom/.env.prod
bin/gh-admin secret set INFRA_PROD_DOTENV_SMALRUBY_RUBYTEE_RELAY --env prod < infra/smalruby-rubytee-relay/.env.prod
```

### 5. 出し直す

Secrets を変えただけでは Lambda の環境変数は変わらない。出し直す。

- **stg**: GitHub Actions の **Deploy Infra** を手で起動する（Bot は手動起動できないので人間が行う）。手動起動では stg だけが出る:
  ```bash
  gh workflow run deploy-infra-stg.yml --repo smalruby/smalruby3-editor --ref develop -f projects=smalruby-classroom,smalruby-rubytee-relay
  ```
- **prod**: prod の job は「develop への push で `infra/**` が変わったとき」だけ動く。次の infra の PR のマージに乗せるか、人間がローカルから `cdk deploy` する（`.claude/rules/infra/development.md`）。

### 6. 確かめる

- **ログ**: Lambda を動かし、CloudWatch Logs の `anthropic_auth` が `mode: "federation"` になっていて、応答が正しく返ることを見る。
  - stg の AI 評価: devlogin（`docs/classroom/testing.md`）で、確認用のクラスを作って採点する。
  - takeover: worker を直接 invoke する（jobs 表に結果が入る）。
  - prod の AI 評価: 先生としてログインし、確認用のクラスで採点する（あとでアーカイブする）。
- **Console**: Workload identity の **認証履歴**（history タブ）に、その時刻の交換の成功が rule 名つきで出ていることを見る。失敗していれば、ここに拒否の理由が出る。
- prompt caching は WIF でも効く（takeover は 2 回目から `cacheReadTokens` が付く。workspace を新しくした直後の 1 回目は `cacheCreationTokens`）。

## よくある失敗

| 症状 | 原因 | 直し方 |
|---|---|---|
| `OutboundWebIdentityFederationDisabledException` | アカウントで有効になっていない | 手順 1 |
| 交換が 401（認証履歴に `iss` の不一致） | issuer の URL が `IssuerIdentifier` と完全に一致していない | Console の issuer を直す |
| 交換が 401（rule に合わない） | `subject_prefix` のロール ARN が違う。CDK がロールを作り直すと、ARN の末尾が変わる | 手順 2 で取り直して rule を直す |
| `GetWebIdentityToken` が AccessDenied | ロールの Condition と `anthropic-client.ts` の呼び出し（audience・署名方式・秒数）がずれている | 両方をそろえる |
| ログが `mode: "none"` | 値の一部が無い、または出し直していない | 手順 4・5 |
| 手元でウィザードのスニペットを動かして 401 | 手元の名義の JWT は rule のロールと合わない（正常） | 手順 6 のとおり Lambda から確かめる |
