# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

このファイルは、このリポジトリでコードを作業する際にClaude Code (claude.ai/code) にガイダンスを提供します。

## 基本原則

- すべてのアウトプットは日本語で、初心者にも理解しやすい丁寧な表現を使用する
- 不明点があれば意図を確認し、わからないまま進めない
- コードを書く前に既存実装をレビューし、その動作と目的を言語化する
- 提案や修正は小さなステップに分解し、各段階で簡易テスト案を示す
- 関数型・宣言型パターンを好み、クラスの使用を避ける
- セキュリティとパフォーマンスを常に意識し、潜在的リスクがあれば早期に指摘する
- 行動を励ますポジティブなトーンを保ち、学習意欲を高める


## プロジェクト概要

TABBIN（タビン）は、React、TypeScript、WXTフレームワークを使用したインテリジェントなタブ管理のためのChrome拡張機能です。スマートな分類とプロジェクトベースの整理を通じて、ユーザーがブラウザタブを整理するのを支援します。

## 開発コマンド

### コア開発
- `npm run dev` - Chrome向けホットリロード付き開発サーバーを起動
- `npm run dev:firefox` - Firefox向け開発サーバーを起動
- `npm run build` - Chrome向けプロダクション拡張機能をビルド
- `npm run build:firefox` - Firefox向けプロダクション拡張機能をビルド
- `npm run zip` - Chrome向け配布可能な拡張機能zipを作成
- `npm run zip:firefox` - Firefox向け配布可能な拡張機能zipを作成

### コード品質とテスト
- `npm run format` - Biomeでコードをフォーマット（コミット前に必須）
- `npm run test` - Vitestでentrypoints配下のユニットテストを実行（Node環境）
- `npm run e2e` - PlaywrightでE2Eテストを実行（Chromium、Firefox、Webkit対応）
- `npm run compile` - TypeScript型チェック（noEmitモード）

### コンポーネント開発
- `npm run storybook` - コンポーネント開発用Storybookをポート6006で起動
- `npm run build-storybook` - Storybookの静的ビルドを作成

## アーキテクチャ概要

### 拡張機能構造
- **WXTフレームワーク**: manifest v3を使用したモダンなWeb拡張機能開発
- **エントリーポイント**: `background.ts`, `saved-tabs/main.tsx`, `options/main.tsx`, `content.ts`
- **機能ベースアーキテクチャ**: ドメイン機能で整理

### 主要システム

**ストレージアーキテクチャ** (`lib/storage/`):
- `tabs.ts` - TabGroup管理（ドメインベース整理）
- `categories.ts` - 階層カテゴリシステム
- `projects.ts` - カスタムプロジェクト管理
- `settings.ts` - ユーザー設定と構成
- `migration.ts` - データ構造マイグレーションシステム

**表示モード** (`lib/view-modes/`):
- ドメインモード: 自動分類でドメイン別にタブを整理
- カスタムモード: プロジェクトベース整理システム

**コア機能**:
- ドメインパターンとキーワードベースの自動分類
- @dnd-kitを使用したドラッグ&ドロップ整理
- Fuse.jsを使用したあいまい検索
- Chrome Storage API統合
- タブ保存のためのコンテキストメニュー統合

### コンポーネントシステム
- **shadcn/ui + Radix UI**: コンポーネント基盤
- **Tailwind CSS 4.x**: カスタムデザインシステムを持つユーティリティファーストスタイリング
- **テーマサポート**: システム設定検出によるダーク/ライトモード

## コードスタイルと標準

### フォーマット（Biome）
- 2スペースインデント
- JS/TSにシングルクォート
- セミコロンは必要な場合のみ（asNeeded）
- 80文字行幅
- import整理有効
- 対象ファイル: `*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}`
- 除外ディレクトリ: `.output`, `.wxt`, `node_modules`

### TypeScript
- ストリクトモード有効 (`strict: true`)
- `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters` など、すべての厳格チェックを有効化
- `any` 型の使用を**禁止**。型が不明な場合は `unknown` と型ガードを使用する
- `var` 宣言を**禁止**。再代入が不要な値は `const`、必要な場合は `let` を使用する
- すべての関数・変数・Props・戻り値に明示的な型注釈を付与し、暗黙の型推論に依存しない
- Enums の代わりにリテラルユニオン型を使用し、バンドルサイズと型安全性を改善する
- オブジェクトや配列には `readonly` 修飾子や `as const` を活用し、イミュータビリティを保証する
- 非同期処理は `Promise<T>` の戻り値型を厳密に定義し、エラーハンドリングを明示する
- React 19 における最新のコンポーネント型付け（Deprecated な `FC` 型の非使用、Props 型は明示）
- `class` 宣言およびクラスベースのコンポーネントを**禁止**し、関数型・宣言型パターンを徹底
- 重複コードを排除し、ユーティリティ関数とモジュール化を優先
- ROROパターン（Receive an Object, Return an Object）を適切に採用し、拡張性と可読性を向上
- フラグや状態の変数名は `isLoading`、`hasError` など補助動詞を用いた説明的な命名とする
- 関数・コンポーネントには JSDoc コメントを必ず付与し、目的・引数・戻り値を明示

### テスト
- **ユニットテスト**: Vitest（Node環境、`entrypoints/**/*.test.ts`対象、モック各テスト後リセット）
- **E2Eテスト**: Playwright（Chromium/Firefox/WebKit対応、CI環境で2回リトライ、HTMLレポート）
- **コンポーネントテスト**: Storybookを使用したUIコンポーネント開発・テスト

## 開発ワークフロー

### Git フック（Lefthook）
- **Pre-commit**: Biomeによる自動フォーマットと修正、ステージング
- **Pre-push**: Biomeによる最終コード品質チェック
- **対象ファイル**: `*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}`

### 品質ゲート
1. Biomeフォーマットが通過する必要
2. TypeScriptコンパイルが成功する必要
3. ユニットテストが通過する必要
4. 主要な変更にはE2Eテストが通過する必要

## 拡張機能固有のパターン

### 使用するChrome API
- `chrome.storage` - 永続化用
- `chrome.tabs` - タブ管理用
- `chrome.contextMenus` - 右クリック統合用
- `chrome.alarms` - 自動クリーンアップ機能用
- `chrome.notifications` - ユーザーフィードバック用

### ストレージパターン
- 型安全ラッパー付きChrome Storage API
- データ構造更新のためのマイグレーションシステム
- ドメインとカスタムプロジェクトモード間の同期

### バックグラウンドスクリプト操作
- タブライフサイクル管理
- コンテキストメニューハンドラー
- 自動分類ロジック
- クリーンアップスケジューリング

## 主要な開発注意事項

- WXT 0.20.5フレームワーク使用、manifest v3対応
- React 19 + TypeScript + Tailwind CSS 4.x構成
- Chrome/Firefox両対応のクロスブラウザ拡張機能
- 国際化構造を持つ日本語中心のUI
- デュアル表示モードアーキテクチャ（ドメイン/カスタム）にはデータ同期が必要
- 自動分類はドメインパターンマッチングに依存
- shadcn/ui + Radix UIコンポーネントパターンに従う
- React 19フックとメモ化でパフォーマンス最適化
- Biome 1.9.4による高速ツールチェーン