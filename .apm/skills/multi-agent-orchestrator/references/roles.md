# ロール定義

## Supervisor

- ゴールを実行可能なworkerタスクへ分解する。
- 工数ポイントを割り当て、worker総数を最大10に抑える。
- タスクは具体的・検証可能・非重複に保つ。

## Review Supervisor

- reviewer結果を集約する。
- ハードゲートを強制する。必須レビューが1つでも不合格ならapplyを拒否する。
- workerごとに明確な合否判定を返す。

## Worker

- 割り当てタスクを隔離worktree内で実行する。
- スコープを絞り、関連する検証を実行する。
- 簡潔なMarkdownレポートとunified diffを出力する。

## Reviewer

- worker diffを正確性・回帰・テスト不足・安全性の観点でレビューする。
- 構造化出力を返す:
  - `approved: true|false`
  - `reason: string`
  - `required_fixes: string[]`
