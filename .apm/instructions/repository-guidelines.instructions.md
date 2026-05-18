---
description: TABBIN エージェント向けのリポジトリ構成、コマンド、スタイル、テスト、完了ゲート。
applyTo: "**/*"
---

# リポジトリガイドライン

## プロジェクト構成とモジュール整理
このリポジトリは WXT ベースのブラウザ拡張機能（TABBIN）です。アプリ本体は `src/` 配下に集約されています。主要なエントリポイントは `src/entrypoints/`（`background.ts`、`options/`、`saved-tabs/`、`changelog/`）にあります。ドメイン機能は `src/features/` 配下にまとまっています（例: `src/features/options`、`src/features/saved-tabs`）。再利用可能な UI と共通 React コンポーネントは `src/components/` と `src/components/ui/` にあります。横断的なロジックは `src/lib/`（background helper、storage、browser wrapper）にあり、共通型は `src/types/`、定数は `src/constants/`、ユーティリティは `src/utils/` にあります。

テストは多くの場合 `*.test.ts` / `*.test.tsx` として対象コードの近くに置かれます。E2E テストは `e2e/`（`*.spec.ts`）にあります。Storybook の story と Storybook 用の補助 assets は `src/` 配下に置きます。ローカル検査や保守用スクリプトは `tools/scripts/` にあります。`.output/`、`coverage/`、`playwright-report/`、`test-results/` などの生成出力ディレクトリは手動編集しないでください。

## ビルド、テスト、開発コマンド
- `bun install`: 依存関係をインストールします（CI は Node `22` と Bun `1.2.8` を使用）。
- `bun run dev` / `bun run dev:firefox`: Chrome / Firefox 向けに WXT dev mode を起動します。
- `bun run build` / `bun run build:firefox`: 本番用の拡張機能をビルドします。
- `bun run zip` / `bun run zip:firefox`: 拡張機能の zip 成果物を作成します。
- `bun run compile`: TypeScript の型チェックを実行します（`tsgo --noEmit`）。
- `bun run test` / `bun run test:coverage`: Vitest テストを実行します（coverage は任意）。
- `bun run e2e`: Playwright のブラウザテストを実行します。
- `bun run quality`: format、lint、Biome check、test、Knip、重複チェックを実行します。

## コーディングスタイルと命名規則
TypeScript + React を ES modules で使います。format / lint は Biome（`biome.json`）で強制されます。2 スペースインデント、80 文字幅、シングルクォート、セミコロンなし（`asNeeded`）です。import 整理は Biome に任せてください。

React コンポーネントは `PascalCase.tsx`（例: `ImportExportSettings.tsx`）、ユーティリティや定数は `camelCase.ts`（例: `autoDeleteOptions.ts`）を使います。現実的な範囲で、テストは検証対象のコードの近くに置いてください。

実装前に既存の helper、型、wrapper、コンポーネント、テスト fixture を探してください。探索には context-mode の `ctx_batch_execute` / `ctx_search`、`rg`、Serena の symbol search を優先し、既存の source of truth を確認してから新しい抽象を追加します。KISS / DRY / YAGNI は守りますが、TABBIN 固有の WXT、APM、Beads、完了ゲートの規則を汎用ルールで置き換えないでください。

## テストガイドライン
主要なテストランナーは Vitest（`vitest.ci.config.ts`）です。E2E フローは `e2e/` の Playwright が担当します。unit / integration テストには `*.test.ts(x)`、Playwright テストには `*.spec.ts` を使います。Vitest 設定上の明示的な coverage 閾値はありませんが、このリポジトリで AI / Codex が完了を報告するには、`bun run test:coverage` が coverage 100% を報告する必要があります。自明でない変更では、PR を開く前に regression test を追加または調整してください。

## エージェント通知（完了ゲート）
このリポジトリで作業する AI / Codex エージェントは、ユーザーへタスク完了を報告する前に、以下を必ず実行してください。

1. `bun run quality` を実行します。
2. `bun run quality` が失敗した場合はエラーを修正し、成功するまで再実行します。
3. `bun run test:coverage` を実行します。
4. coverage が `100` でない場合はテストを追加または修正し、coverage が `100` になるまで再実行します。
5. 両方のコマンドが成功し、coverage が `100` になるまで完了を主張しないでください。

環境やツール起因の問題（例: リポジトリコードと無関係な runtime panic）でブロックされた場合は、完了を主張せず、ブロッカーとして明示的に報告してください。

検証は変更スコープに合わせて選びますが、完了ゲートを弱めてはいけません。Markdown や `.apm` source だけを変更した場合でも、少なくとも `apm compile --validate` と、生成物を更新する必要がある場合は `apm compile` / `apm install` を実行します。TypeScript / React / storage / background / UI の変更では、関連する targeted test に加えて、最終的に `bun run quality` と `bun run test:coverage` 100% を確認します。

## Beads issue 管理
このプロジェクトでは、永続的な issue tracking に Beads（`bd`）を使います。ワークフローのガイダンスには `.agents/skills/beads/SKILL.md` の `beads` skill を使い、利用可能な場合は issue 操作に `bd` CLI を使ってください。

Beads のコンテキストが存在しない、または古い場合は `bd prime` を実行します。着手可能な作業の確認には `bd ready`、issue の確認には `bd show <id>`、作業の claim には `bd update <id> --claim` を使います。`bd close <id>` は作業が実際に完了してからのみ使ってください。

共有プロジェクトタスク、ブロッカー、依存関係、発見した follow-up 作業、handoff 状態には Beads を使ってください。Markdown の TODO リストを source of truth にしないでください。永続的なプロジェクトメモリは `bd remember` で Beads に残してください。

作業セッションを終えるときは、残った follow-up 作業の issue を作成し、コードが変わった場合は必須 quality gate を実行し、Beads issue の状態を更新し、完了したブランチを push してください。`git push` が成功し、`git status` でブランチが origin と同期済みであることを確認するまで、作業は完了ではありません。push や Beads 操作がローカルツールや認証情報でブロックされた場合は、そのブロッカーを明示的に報告してください。

## Commit と Pull Request のガイドライン
最近の履歴では、簡潔な件名（日本語が多い）と merge commit が使われています。1 つの変更を説明する、短く命令形の commit message を優先してください。PR は `main` を target にし、`変更内容` に変更点をまとめ、チェックリストでローカル検証（`ローカル環境でエラーになっていない`）を確認してください。関連 issue をリンクし、UI 変更では screenshot / GIF を含めてください。

PR 作成前には、base branch との差分、直近の関連 commit、生成 artifact の混入有無を確認してください。`.apm` で管理される内容は source 側の変更と生成先の同期が揃っていることを確認し、generated files だけの手編集を PR の根拠にしないでください。

`lefthook` は pre-commit で `biome check --write`、pre-push で `bun run quality` を実行します。push 前にローカルでブランチを green に保ってください。
