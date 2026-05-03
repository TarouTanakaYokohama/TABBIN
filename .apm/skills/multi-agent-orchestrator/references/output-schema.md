# 出力契約

## plan.json

```json
{
  "goal": "string",
  "max_workers": 10,
  "tasks": [
    {
      "id": "worker-1",
      "title": "string",
      "description": "string",
      "effort_points": 1,
      "area": "rust|react|shared|infra"
    }
  ]
}
```

## reviews/<worker-id>.json

```json
{
  "worker_id": "worker-1",
  "approved": true,
  "reason": "string",
  "required_fixes": []
}
```

## final-report.md

含める項目:

1. ゴールとモード。
2. Worker実行サマリ。
3. Workerごとのレビューゲート結果。
4. 適用済みdiff一覧（存在する場合）。
5. クリーンアップチェック要約（残存/新規リークworktree）。
6. 検証コマンドの実行サマリ。
