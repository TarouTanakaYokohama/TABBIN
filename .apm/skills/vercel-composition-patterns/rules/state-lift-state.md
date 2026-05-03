---
title: 状態をプロバイダーコンポーネントにリフトアップする
impact: HIGH
impactDescription: コンポーネント境界の外で状態共有を可能にする
tags: composition, state, context, providers
---

## 状態をプロバイダーコンポーネントにリフトアップする

状態管理を専用のプロバイダーコンポーネントに移動します。これにより、メインUIの外側
の兄弟コンポーネントが、propドリリングや厄介なrefsなしで状態にアクセスして変更
できます。

**不適切（コンポーネント内に閉じ込められた状態）:**

```tsx
function ForwardMessageComposer() {
  const [state, setState] = useState(initialState)
  const forwardMessage = useForwardMessage()

  return (
    <Composer.Frame>
      <Composer.Input />
      <Composer.Footer />
    </Composer.Frame>
  )
}

// 問題: このボタンはどうやってコンポーザーの状態にアクセスする？
function ForwardMessageDialog() {
  return (
    <Dialog>
      <ForwardMessageComposer />
      <MessagePreview /> {/* コンポーザーの状態が必要 */}
      <DialogActions>
        <CancelButton />
        <ForwardButton /> {/* submitを呼び出す必要がある */}
      </DialogActions>
    </Dialog>
  )
}
```

**不適切（useEffectで状態を同期）:**

```tsx
function ForwardMessageDialog() {
  const [input, setInput] = useState('')
  return (
    <Dialog>
      <ForwardMessageComposer onInputChange={setInput} />
      <MessagePreview input={input} />
    </Dialog>
  )
}

function ForwardMessageComposer({ onInputChange }) {
  const [state, setState] = useState(initialState)
  useEffect(() => {
    onInputChange(state.input) // 変更のたびに同期 😬
  }, [state.input])
}
```

**不適切（送信時にrefから状態を読み取る）:**

```tsx
function ForwardMessageDialog() {
  const stateRef = useRef(null)
  return (
    <Dialog>
      <ForwardMessageComposer stateRef={stateRef} />
      <ForwardButton onPress={() => submit(stateRef.current)} />
    </Dialog>
  )
}
```

**適切（プロバイダーにリフトアップされた状態）:**

```tsx
function ForwardMessageProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(initialState)
  const forwardMessage = useForwardMessage()
  const inputRef = useRef(null)

  return (
    <Composer.Provider
      state={state}
      actions={{ update: setState, submit: forwardMessage }}
      meta={{ inputRef }}
    >
      {children}
    </Composer.Provider>
  )
}

function ForwardMessageDialog() {
  return (
    <ForwardMessageProvider>
      <Dialog>
        <ForwardMessageComposer />
        <MessagePreview /> {/* カスタムコンポーネントが状態とアクションにアクセス可能 */}
        <DialogActions>
          <CancelButton />
          <ForwardButton /> {/* カスタムコンポーネントが状態とアクションにアクセス可能 */}
        </DialogActions>
      </Dialog>
    </ForwardMessageProvider>
  )
}

function ForwardButton() {
  const { actions } = use(Composer.Context)
  return <Button onPress={actions.submit}>転送</Button>
}
```

ForwardButtonは Composer.Frame の外側にありますが、プロバイダー内にあるため、
submitアクションにアクセスできます。1回限りのコンポーネントであっても、UI自体の
外側からコンポーザーの状態とアクションにアクセスできます。

**重要な洞察:** 共有状態が必要なコンポーネントは、視覚的に互いにネストされて
いる必要はありません。同じプロバイダー内にあればよいのです。
