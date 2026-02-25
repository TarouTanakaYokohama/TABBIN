type ShouldShowUncategorizedHeaderInput = {
  searchQuery: string
  uncategorizedCount: number
  visibleUncategorizedCount: number
  isUncategorizedReorderMode: boolean
}

export function shouldShowUncategorizedHeader({
  searchQuery,
  uncategorizedCount,
  visibleUncategorizedCount,
  isUncategorizedReorderMode,
}: ShouldShowUncategorizedHeaderInput): boolean {
  if (isUncategorizedReorderMode) {
    return true
  }

  const hasSearchQuery = searchQuery.trim().length > 0

  return hasSearchQuery ? visibleUncategorizedCount > 0 : uncategorizedCount > 0
}
