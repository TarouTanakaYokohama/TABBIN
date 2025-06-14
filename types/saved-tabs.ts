import type { ParentCategory, TabGroup, UserSettings } from './storage'

// カテゴリグループコンポーネント
export interface CategoryGroupProps {
  category: ParentCategory
  domains: TabGroup[]
  handleOpenAllTabs: (urls: { url: string; title: string }[]) => void
  handleDeleteGroup: (id: string) => void
  handleDeleteUrl: (groupId: string, url: string) => void
  handleOpenTab: (url: string) => void
  handleUpdateUrls: (groupId: string, updatedUrls: TabGroup['urls']) => void
  handleUpdateDomainsOrder?: (
    categoryId: string,
    updatedDomains: TabGroup[],
  ) => void
  handleMoveDomainToCategory?: (
    domainId: string,
    fromCategoryId: string | null,
    toCategoryId: string,
  ) => void
  handleDeleteCategory?: (groupId: string, categoryName: string) => void
  settings: UserSettings
}

// ドメインカード用のソータブルコンポーネントの型
export interface SortableDomainCardProps {
  group: TabGroup
  handleOpenAllTabs: (urls: { url: string; title: string }[]) => void
  handleDeleteGroup: (id: string) => void
  handleDeleteUrl: (groupId: string, url: string) => void
  handleOpenTab: (url: string) => void
  handleUpdateUrls: (groupId: string, updatedUrls: TabGroup['urls']) => void
  handleDeleteCategory?: (groupId: string, categoryName: string) => void
  categoryId?: string // 親カテゴリID
  isDraggingOver?: boolean // ドラッグオーバー状態
  settings?: UserSettings // 設定プロパティ
}

// カテゴリセクションコンポーネント
export interface CategorySectionProps {
  categoryName: string
  urls: TabGroup['urls']
  groupId: string
  handleDeleteUrl: (groupId: string, url: string) => void
  handleOpenTab: (url: string) => void
  handleUpdateUrls: (groupId: string, updatedUrls: TabGroup['urls']) => void
  handleOpenAllTabs?: (urls: { url: string; title: string }[]) => void
  settings: UserSettings
}

// 並び替え可能なカテゴリセクションコンポーネント
export interface SortableCategorySectionProps extends CategorySectionProps {
  id: string // ソート用の一意のID
  handleOpenAllTabs: (urls: { url: string; title: string }[]) => void // すべて開く処理
}

// URL項目用のソータブルコンポーネント
export interface SortableUrlItemProps {
  url: string
  title: string
  id: string
  groupId: string
  subCategory?: string
  savedAt?: number
  autoDeletePeriod?: string
  availableSubCategories?: string[]
  handleDeleteUrl: (groupId: string, url: string) => void
  handleOpenTab: (url: string) => void
  handleSetSubCategory?: (
    groupId: string,
    url: string,
    subCategory: string,
  ) => void
  handleUpdateUrls: (
    groupId: string,
    updatedUrls: { url: string; title: string; subCategory?: string }[],
  ) => void
  categoryContext?: string
  settings: UserSettings
}

// カード内のURL一覧
export interface UrlListProps {
  items: TabGroup['urls']
  groupId: string
  subCategories?: string[]
  handleDeleteUrl: (groupId: string, url: string) => void
  handleOpenTab: (url: string) => void
  handleUpdateUrls: (groupId: string, updatedUrls: TabGroup['urls']) => void
  handleSetSubCategory?: (
    groupId: string,
    url: string,
    subCategory: string,
  ) => void
  settings: UserSettings
}

// カテゴリキーワード管理モーダルコンポーネント
export interface CategoryKeywordModalProps {
  group: TabGroup
  isOpen: boolean
  onClose: () => void
  onSave: (groupId: string, categoryName: string, keywords: string[]) => void
  onDeleteCategory: (groupId: string, categoryName: string) => void
  parentCategories: ParentCategory[]
  onCreateParentCategory: (name: string) => Promise<ParentCategory>
  onAssignToParentCategory: (
    groupId: string,
    categoryId: string,
  ) => Promise<void>
  onUpdateParentCategories?: (categories: ParentCategory[]) => void
}
