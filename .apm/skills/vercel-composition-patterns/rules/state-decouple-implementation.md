---
title: 状態管理とUIを分離する
impact: MEDIUM
impactDescription: UIを変更せずに状態実装を入れ替え可能にする
tags: composition, state, architecture
---

## 状態管理とUIを分離する

プロバイダーコンポーネントは、状態がどのように管理されているかを知る唯一の場所で
あるべきです。UIコンポーネントはコンテキストインターフェースを消費します。状態が
useState、Zustand、サーバー同期のどれから来ているかは知りません。

**不適切（状態実装に結合したUI）:**

```tsx
function ChannelComposer({ channelId }: { channelId: string }) {
  // UIコンポーネントがグローバル状態の実装を知っている
  const state = useGlobalChannelState(channelId)
  const { submit, updateInput } = useChannelSync(channelId)

  return (
    <Composer.Frame>
      <Composer.Input
        value={state.input}
        onChange={(text) => sync.updateInput(text)}
      />
      <Composer.Submit onPress={() => sync.submit()} />
    </Composer.Frame>
  )
}
```

**適切（プロバイダーに分離された状態管理）:**

```tsx
// プロバイダーがすべての状態管理の詳細を処理
function ChannelProvider({
  channelId,
  children,
}: {
  channelId: string
  children: React.ReactNode
}) {
  const { state, update, submit } = useGlobalChannel(channelId)
  const inputRef = useRef(null)

  return (
    <Composer.Provider
      state={state}
      actions={{ update, submit }}
      meta={{ inputRef }}
    >
      {children}
    </Composer.Provider>
  )
}

// UIコンポーネントはコンテキストインターフェースのみを知っている
function ChannelComposer() {
  return (
    <Composer.Frame>
      <Composer.Header />
      <Composer.Input />
      <Composer.Footer>
        <Composer.Submit />
      </Composer.Footer>
    </Composer.Frame>
  )
}

// 使用法
function Channel({ channelId }: { channelId: string }) {
  return (
    <ChannelProvider channelId={channelId}>
      <ChannelComposer />
    </ChannelProvider>
  )
}
```

**異なるプロバイダー、同じUI:**

```tsx
// エフェメラルフォーム用のローカル状態
function ForwardMessageProvider({ children }) {
  const [state, setState] = useState(initialState)
  const forwardMessage = useForwardMessage()

  return (
    <Composer.Provider
      state={state}
      actions={{ update: setState, submit: forwardMessage }}
    >
      {children}
    </Composer.Provider>
  )
}

// チャンネル用のグローバル同期状態
function ChannelProvider({ channelId, children }) {
  const { state, update, submit } = useGlobalChannel(channelId)

  return (
    <Composer.Provider state={state} actions={{ update, submit }}>
      {children}
    </Composer.Provider>
  )
}
```

同じ `Composer.Input` コンポーネントは両方のプロバイダーで動作します。なぜなら、
実装ではなくコンテキストインターフェースのみに依存しているためです。
