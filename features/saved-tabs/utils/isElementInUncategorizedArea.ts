// filepath: features/saved-tabs/utils/isElementInUncategorizedArea.ts
/**
 * 要素が未分類エリア内にあるかを判定するユーティリティ関数
 * @param element 判定対象のHTMLElement
 * @returns 未分類エリア内ならtrue
 */
export function isElementInUncategorizedArea(element: HTMLElement): boolean {
  let currentElement = element
  const maxDepth = 10 // 無限ループを避けるための最大探索深度

  for (let i = 0; i < maxDepth && currentElement; i++) {
    if (
      currentElement.getAttribute('data-uncategorized-area') === 'true' ||
      currentElement.getAttribute('data-type') === 'uncategorized' ||
      currentElement.id?.includes('uncategorized') ||
      currentElement.classList.contains('uncategorized-area')
    ) {
      return true
    }
    // 親要素に遡る
    currentElement = currentElement.parentElement as HTMLElement
    if (!currentElement) break
  }
  return false
}
