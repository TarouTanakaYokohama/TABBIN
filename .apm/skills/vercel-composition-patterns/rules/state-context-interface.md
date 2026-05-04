---
title: 依存性注入のための汎用コンテキストインターフェースを定義する
impact: HIGH
impactDescription: ユースケース間で依存性注入可能な状態を可能にする
tags: composition, context, state, typescript, dependency-injection
---

## 依存性注入のための汎用コンテキストインターフェースを定義する

コンポーネントコンテキストの**汎用インターフェース**を3つの部分で定義します：
`state`、`actions`、`meta`。このインターフェースは、任意のプロバイダーが実装できる
契約です。これにより、同じUIコンポーネントを完全に異なる状態実装で動作させることが
できます。

**核心原則:** 状態をリフトアップし、内部をコンポーズし、状態を依存性注入可能に
します。

**不適切（特定の状態実装に結合したUI）:**

```tsx
function ComposerInput() {
  // 特定のフックに密結合
  const { input, setInput } = useChannelComposerState()
  return <TextInput value={input} onChangeText={setInput} />
}
```

**適切（汎用インターフェースが依存性注入を可能にする）:**

```tsx
// 任意のプロバイダーが実装できる汎用インターフェースを定義
interface ComposerState {
  input: string
  attachments: Attachment[]
  isSubmitting: boolean
}

interface ComposerActions {
  update: (updater: (state: ComposerState) => ComposerState) => void
  submit: () => void
}

interface ComposerMeta {
  inputRef: React.RefObject<TextInput>
}

interface ComposerContextValue {
  state: ComposerState
  actions: ComposerActions
  meta: ComposerMeta
}

const ComposerContext = createContext<ComposerContextValue | null>(null)
```

**UIコンポーネントは実装ではなくインターフェースを消費:**

```tsx
function ComposerInput() {
  const {
    state,
    actions: { update },
    meta,
  } = use(ComposerContext)

  // このコンポーネントはインターフェースを実装する任意のプロバイダーで動作
  return (
    <TextInput
      ref={meta.inputRef}
      value={state.input}
      onChangeText={(text) => update((s) => ({ ...s, input: text }))}
    />
  )
}
```

**異なるプロバイダーが同じインターフェースを実装:**

```tsx
// プロバイダーA: エフェメラルフォーム用のローカル状態
function ForwardMessageProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(initialState)
  const inputRef = useRef(null)
  const submit = useForwardMessage()

  return (
    <ComposerContext
      value={{
        state,
        actions: { update: setState, submit },
        meta: { inputRef },
      }}
    >
      {children}
    </ComposerContext>
  )
}

// プロバイダーB: チャンネル用のグローバル同期状態
function ChannelProvider({ channelId, children }: Props) {
  const { state, update, submit } = useGlobalChannel(channelId)
  const inputRef = useRef(null)

  return (
    <ComposerContext
      value={{
        state,
        actions: { update, submit },
        meta: { inputRef },
      }}
    >
      {children}
    </ComposerContext>
  )
}
```

**同じコンポーズされたUIが両方で動作:**

```tsx
// ForwardMessageProvider（ローカル状態）で動作
<ForwardMessageProvider>
  <Composer.Frame>
    <Composer.Input />
    <Composer.Submit />
  </Composer.Frame>
</ForwardMessageProvider>

// ChannelProvider（グローバル同期状態）で動作
<ChannelProvider channelId="abc">
  <Composer.Frame>
    <Composer.Input />
    <Composer.Submit />
  </Composer.Frame>
</ChannelProvider>
```

**コンポーネント外のカスタムUIが状態とアクションにアクセス可能:**

プロバイダーの境界が重要です。ビジュアルなネストではありません。共有状態が必要な
コンポーネントは、`Composer.Frame` の内部である必要はありません。プロバイダー内に
あればよいのです。

```tsx
function ForwardMessageDialog() {
  return (
    <ForwardMessageProvider>
      <Dialog>
        {/* コンポーザーUI */}
        <Composer.Frame>
          <Composer.Input placeholder="必要に応じてメッセージを追加してください。" />
          <Composer.Footer>
            <Composer.Formatting />
            <Composer.Emojis />
          </Composer.Footer>
        </Composer.Frame>

        {/* コンポーザーの外部だがプロバイダーの内部のカスタムUI */}
        <MessagePreview />

        {/* ダイアログの下部にあるアクション */}
        <DialogActions>
          <CancelButton />
          <ForwardButton />
        </DialogActions>
      </Dialog>
    </ForwardMessageProvider>
  )
}

// このボタンはComposer.Frameの外部にあるが、そのコンテキストに基づいて送信できる！
function ForwardButton() {
  const {
    actions: { submit },
  } = use(ComposerContext)
  return <Button onPress={submit}>転送</Button>
}

// このプレビューはComposer.Frameの外部にあるが、コンポーザーの状態を読み取れる！
function MessagePreview() {
  const { state } = use(ComposerContext)
  return <Preview message={state.input} attachments={state.attachments} />
}
```

`ForwardButton` と `MessagePreview` は、コンポーザーボックスの視覚的には内部に
ありませんが、その状態とアクションにアクセスできます。これが状態をプロバイダーに
リフトアップすることの力です。

UIは一緒にコンポーズする再利用可能なビットです。状態はプロバイダーによって依存性
注入されます。プロバイダーを入れ替え、UIを保持します。
