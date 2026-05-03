---
title: Render Propsよりもchildrenのコンポジションを優先する
impact: MEDIUM
impactDescription: よりクリーンなコンポジション、より良い可読性
tags: composition, children, render-props
---

## Render Propsよりもchildrenを優先する

`renderX` propsの代わりに `children` をコンポジションに使用します。childrenはより
読みやすく、自然にコンポーズでき、コールバックシグネチャを理解する必要がありません。

**不適切（render props）:**

```tsx
function Composer({
  renderHeader,
  renderFooter,
  renderActions,
}: {
  renderHeader?: () => React.ReactNode
  renderFooter?: () => React.ReactNode
  renderActions?: () => React.ReactNode
}) {
  return (
    <form>
      {renderHeader?.()}
      <Input />
      {renderFooter ? renderFooter() : <DefaultFooter />}
      {renderActions?.()}
    </form>
  )
}

// 使用法が厄介で柔軟性がない
return (
  <Composer
    renderHeader={() => <CustomHeader />}
    renderFooter={() => (
      <>
        <Formatting />
        <Emojis />
      </>
    )}
    renderActions={() => <SubmitButton />}
  />
)
```

**適切（childrenを使った複合コンポーネント）:**

```tsx
function ComposerFrame({ children }: { children: React.ReactNode }) {
  return <form>{children}</form>
}

function ComposerFooter({ children }: { children: React.ReactNode }) {
  return <footer className='flex'>{children}</footer>
}

// 使用法が柔軟
return (
  <Composer.Frame>
    <CustomHeader />
    <Composer.Input />
    <Composer.Footer>
      <Composer.Formatting />
      <Composer.Emojis />
      <SubmitButton />
    </Composer.Footer>
  </Composer.Frame>
)
```

**render propsが適切な場合:**

```tsx
// render propsは親が子にデータを渡す必要がある場合にうまく機能します
<List
  data={items}
  renderItem={({ item, index }) => <Item item={item} index={index} />}
/>
```

親が子にデータや状態を提供する必要がある場合はrender propsを使用します。
静的な構造をコンポーズする場合はchildrenを使用します。
