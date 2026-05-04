---
title: Boolean Propの増殖を避ける
impact: CRITICAL
impactDescription: メンテナンス不可能なコンポーネントバリアントを防ぐ
tags: composition, props, architecture
---

## Boolean Propの増殖を避ける

`isThread`、`isEditing`、`isDMThread` のようなboolean propsを追加してコンポーネントの
動作をカスタマイズしないでください。各booleanは可能な状態を2倍にし、メンテナンス
不可能な条件ロジックを作成します。代わりにコンポジションを使用してください。

**不適切（boolean propsが指数関数的な複雑さを生む）:**

```tsx
function Composer({
  onSubmit,
  isThread,
  channelId,
  isDMThread,
  dmId,
  isEditing,
  isForwarding,
}: Props) {
  return (
    <form>
      <Header />
      <Input />
      {isDMThread ? (
        <AlsoSendToDMField id={dmId} />
      ) : isThread ? (
        <AlsoSendToChannelField id={channelId} />
      ) : null}
      {isEditing ? (
        <EditActions />
      ) : isForwarding ? (
        <ForwardActions />
      ) : (
        <DefaultActions />
      )}
      <Footer onSubmit={onSubmit} />
    </form>
  )
}
```

**適切（コンポジションが条件文を排除する）:**

```tsx
// チャンネルコンポーザー
function ChannelComposer() {
  return (
    <Composer.Frame>
      <Composer.Header />
      <Composer.Input />
      <Composer.Footer>
        <Composer.Attachments />
        <Composer.Formatting />
        <Composer.Emojis />
        <Composer.Submit />
      </Composer.Footer>
    </Composer.Frame>
  )
}

// スレッドコンポーザー - 「チャンネルにも送信」フィールドを追加
function ThreadComposer({ channelId }: { channelId: string }) {
  return (
    <Composer.Frame>
      <Composer.Header />
      <Composer.Input />
      <AlsoSendToChannelField id={channelId} />
      <Composer.Footer>
        <Composer.Formatting />
        <Composer.Emojis />
        <Composer.Submit />
      </Composer.Footer>
    </Composer.Frame>
  )
}

// 編集コンポーザー - 異なるフッターアクション
function EditComposer() {
  return (
    <Composer.Frame>
      <Composer.Input />
      <Composer.Footer>
        <Composer.Formatting />
        <Composer.Emojis />
        <Composer.CancelEdit />
        <Composer.SaveEdit />
      </Composer.Footer>
    </Composer.Frame>
  )
}
```

各バリアントは何をレンダリングするかを明示的に示します。単一のモノリシックな親を
共有することなく、内部を共有できます。
