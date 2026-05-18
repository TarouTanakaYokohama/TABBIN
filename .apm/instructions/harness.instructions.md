---
description: Generator/Evaluator ハーネスのワークフローと状態ファイル規約。
applyTo: "**/*"
---

# Generator/Evaluator ハーネス

このリポジトリは、複雑なエージェント作業に軽量な Generator/Evaluator
ハーネスを使います。

## 役割

- **Generator**: ユーザーのタスクを実装するメインセッション。
- **Evaluator**: 完了した Generator の成果物を、ユーザー依頼、リポジトリ指示、
  検証証跡と照合してレビューする新しいコンテキストのサブエージェント。

このハーネスに Planner や Orchestrator レイヤーを追加しないでください。
計画、実装、最終統合はメインセッションが担当します。

## 状態ファイル

ハーネスの状態は `.agents/harness/` 配下に置きます。

- `.agents/harness/ACTIVE`: run id または run ディレクトリパスを入れる任意の
  テキストファイル。
- `.agents/harness/runs/<run-id>/task.md`: 元タスクまたは実装ブリーフ。
- `.agents/harness/runs/<run-id>/generator.json`: Generator の状態。
- `.agents/harness/runs/<run-id>/evaluator.json`: Evaluator の状態と指摘。
- `.agents/harness/runs/<run-id>/decision.json`: 必要な場合の最終レビュー判断。

JSON ファイルは小さく保ち、`status`、`summary`、`updated_at`、
`next_action` フィールドを明示してください。有効な `status` 値は
`pending`、`running`、`done`、`approved`、`changes_requested`、`blocked`
です。

## ワークフロー

1. Generator がアクティブな run ディレクトリを作成または更新します。
2. Generator がメインセッションで実装と検証を行います。
3. Generator が検証証跡を `generator.json` に記録します。
4. Evaluator を新しいコンテキストで手動起動するときは
   `.apm/prompts/harness-evaluator.prompt.md` を使います。
5. Evaluator は `approved`、`changes_requested`、`blocked` のいずれかを
   `evaluator.json` に書きます。
6. `approved` の場合、Generator はリポジトリの完了ゲートへ進みます。
   変更要求がある場合は対応します。

## 評価観点

Evaluator は、実装量やテスト成功だけを完了判断にしません。ユーザー依頼の
明示要件、計画、変更ファイル、生成 artifact、検証証跡を対応付け、
抜け・弱い検証・source-of-truth 逸脱を確認します。

大きい変更では、必要に応じて以下を区別して評価してください。

- capability eval: 依頼された能力やワークフローが実際に成立しているか。
- regression eval: 元の不具合や失敗パターンが再発しないか。
- code-based grader: テスト、型チェック、lint、coverage、静的検査。
- model-based grader: 実装意図、指示遵守、運用リスクの fresh-context レビュー。
- human grader: ユーザー判断が必要な設計、UI、運用ポリシー。

hook は Evaluator を自動起動しません。hook は `.agents/harness/ACTIVE` と
JSON 状態ファイルから推測した現在のハーネス状態と次アクションのみを
表示してください。

リポジトリの完了ゲートは、既存の Stop 検証フローを維持します。
