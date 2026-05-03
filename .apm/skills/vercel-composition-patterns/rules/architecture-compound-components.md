---
title: 複合コンポーネントを使用する
impact: HIGH
impactDescription: propドリリングなしで柔軟なコンポジションを可能にする
tags: composition, compound-components, architecture
---

## 複合コンポーネントを使用する

複雑なコンポーネントを、共有コンテキストを持つ複合コンポーネントとして構造化します。各
サブコンポーネントは、propsではなくコンテキストを介して共有状態にアクセスします。
コンシューマーは必要な部分をコンポーズします。

**不適切（render propsを持つモノリシックなコンポーネント）:**

```tsx
function Composer({
  renderHeader,
  renderFooter,
  renderActions,
  showAttachments,
  showFormatting,
  showEmojis,
}: Props) {
  return (
    <form>
      {renderHeader?.()}
      <Input />
      {showAttachments && <Attachments />}
      {renderFooter ? (
        renderFooter()
      ) : (
        <Footer>
          {showFormatting && <Formatting />}
          {showEmojis && <Emojis />}
          {renderActions?.()}
        </Footer>
      )}
    </form>
  )
}
```

**適切（共有コンテキストを持つ複合コンポーネント）:**

```tsx
const ComposerContext = createContext<ComposerContextValue | null>(null)

function ComposerProvider({ children, state, actions, meta }: ProviderProps) {
  return (
    <ComposerContext value={{ state, actions, meta }}>
      {children}
    </ComposerContext>
  )
}

function ComposerFrame({ children }: { children: React.ReactNode }) {
  return <form>{children}</form>
}

function ComposerInput() {
  const {
    state,
    actions: { update },
    meta: { inputRef },
  } = use(ComposerContext)
  return (
    <TextInput
      ref={inputRef}
      value={state.input}
      onChangeText={(text) => update((s) => ({ ...s, input: text }))}
    />
  )
}

function ComposerSubmit() {
  const {
    actions: { submit },
  } = use(ComposerContext)
  return <Button onPress={submit}>送信</Button>
}

// 複合コンポーネントとしてエクスポート
const Composer = {
  Provider: ComposerProvider,
  Frame: ComposerFrame,
  Input: ComposerInput,
  Submit: ComposerSubmit,
  Header: ComposerHeader,
  Footer: ComposerFooter,
  Attachments: ComposerAttachments,
  Formatting: ComposerFormatting,
  Emojis: ComposerEmojis,
}
```

**使用法:**

```tsx
<Composer.Provider state={state} actions={actions} meta={meta}>
  <Composer.Frame>
    <Composer.Header />
    <Composer.Input />
    <Composer.Footer>
      <Composer.Formatting />
      <Composer.Submit />
    </Composer.Footer>
  </Composer.Frame>
</Composer.Provider>
```

コンシューマーは必要なものを明示的にコンポーズします。隠された条件文はありません。
そして状態、アクション、metaは親プロバイダーによって依存性注入され、同じコンポーネント
構造の複数の使用を可能にします。
