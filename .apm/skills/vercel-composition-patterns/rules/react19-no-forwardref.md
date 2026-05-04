---
title: React 19 API変更
impact: MEDIUM
impactDescription: よりクリーンなコンポーネント定義とコンテキスト使用
tags: react19, refs, context, hooks
---

## React 19 API変更

> **⚠️ React 19以降のみ。** React 18以前を使用している場合は、このセクションをスキップしてください。

React 19では、`ref` は通常のpropになりました（`forwardRef` ラッパーは不要）。
そして `use()` が `useContext()` を置き換えます。

**不適切（React 19でのforwardRef）:**

```tsx
const ComposerInput = forwardRef<TextInput, Props>((props, ref) => {
  return <TextInput ref={ref} {...props} />
})
```

**適切（refを通常のpropとして）:**

```tsx
function ComposerInput({ ref, ...props }: Props & { ref?: React.Ref<TextInput> }) {
  return <TextInput ref={ref} {...props} />
}
```

**不適切（React 19でのuseContext）:**

```tsx
const value = useContext(MyContext)
```

**適切（useContextの代わりにuseを使用）:**

```tsx
const value = use(MyContext)
```

`use()` は `useContext()` とは異なり、条件付きで呼び出すこともできます。
