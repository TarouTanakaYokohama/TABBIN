---
name: multi-agent-orchestrator
description: Supervisor・Review Supervisor・最大10並列Workerで構成する、Codex CLI向け階層型マルチエージェントオーケストレーション。レビューゲート、dry-run/applyモード、Markdownとunified diff成果物、全レビュー通過後のみのパッチ適用が必要な複雑な実装・テストタスクで使用する。
---

# マルチエージェントオーケストレーター

現在のリポジトリで階層型マルチエージェントワークフローを実行する。

## 実行方法

Dry-run（パッチを適用しない）:

```bash
node scripts/orchestrate.mjs \
  --mode dry-run \
  --workers auto \
  --task "<goal>"
```

Applyモード（承認済みdiffのみ適用）:

```bash
node scripts/orchestrate.mjs \
  --mode apply \
  --workers auto \
  --task "<goal>"
```

APM などで別ディレクトリへ配布されている場合は、この skill
ディレクトリを基準に `scripts/orchestrate.mjs` を解決する。

## 挙動

- 階層は `Supervisor -> Review Supervisor -> Workers` を維持する。
- Workerは並列で実行する。
- Worker数は `1..10` に制限する。
- 成果物は `.agents/runs/<run-id>/` に保存する。
- apply実行前に全レビュー合格を必須とする。
- 実行終了時に必ずクリーンアップ検証を実行し、残存worktree登録を報告する。
- 自動でcommit/pushしない。

## 成果物

期待する出力:

- `plan.json`
- `workers/<worker-id>/report.md`
- `workers/<worker-id>/changes.diff`
- `reviews/<worker-id>.json`
- `final-report.md`

## ロール・出力仕様の参照

- ロール定義: `references/roles.md`
- 出力契約: `references/output-schema.md`
