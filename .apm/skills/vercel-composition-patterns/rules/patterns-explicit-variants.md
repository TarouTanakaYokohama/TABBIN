---
title: 明示的なコンポーネントバリアントを作成する
impact: MEDIUM
impactDescription: 自己文書化コード、隠れた条件文なし
tags: composition, variants, architecture
---

## 明示的なコンポーネントバリアントを作成する

多くのboolean propsを持つ1つのコンポーネントの代わりに、明示的なバリアント
コンポーネントを作成します。各バリアントは必要な部分をコンポーズします。コードは
自己文書化されます。

**不適切（1つのコンポーネント、多くのモード）:**

```tsx
// このコンポーネントは実際に何をレンダリングする？
<Composer
  isThread
  isEditing={false}
  channelId='abc'
  showAttachments
  showFormatting={false}
/>
```

**適切（明示的なバリアント）:**

```tsx
// 何をレンダリングするかすぐに明確
<ThreadComposer channelId="abc" />

// または
<EditMessageComposer messageId="xyz" />

// または
<ForwardMessageComposer messageId="123" />
```

各実装はユニーク、明示的、自己完結型です。それでも、それぞれが共有部分を使用
できます。

**実装:**

```tsx
function ThreadComposer({ channelId }: { channelId: string }) {
  return (
    <ThreadProvider channelId={channelId}>
      <Composer.Frame>
        <Composer.Input />
        <AlsoSendToChannelField channelId={channelId} />
        <Composer.Footer>
          <Composer.Formatting />
          <Composer.Emojis />
          <Composer.Submit />
        </Composer.Footer>
      </Composer.Frame>
    </ThreadProvider>
  )
}

function EditMessageComposer({ messageId }: { messageId: string }) {
  return (
    <EditMessageProvider messageId={messageId}>
      <Composer.Frame>
        <Composer.Input />
        <Composer.Footer>
          <Composer.Formatting />
          <Composer.Emojis />
          <Composer.CancelEdit />
          <Composer.SaveEdit />
        </Composer.Footer>
      </Composer.Frame>
    </EditMessageProvider>
  )
}

function ForwardMessageComposer({ messageId }: { messageId: string }) {
  return (
    <ForwardMessageProvider messageId={messageId}>
      <Composer.Frame>
        <Composer.Input placeholder="必要に応じてメッセージを追加してください。" />
        <Composer.Footer>
          <Composer.Formatting />
          <Composer.Emojis />
          <Composer.Mentions />
        </Composer.Footer>
      </Composer.Frame>
    </ForwardMessageProvider>
  )
}
```

各バリアントは以下について明示的です:

- 使用するプロバイダー/状態
- 含めるUI要素
- 利用可能なアクション

boolean propの組み合わせについて推論する必要はありません。不可能な状態もありません。
