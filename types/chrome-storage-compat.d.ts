import type {
  CustomProject,
  DomainCategorySettings,
  DomainParentCategoryMapping,
  ParentCategory,
  TabGroup,
  UrlRecord,
  UserSettings,
  ViewMode,
} from './storage'

type ThemePreference = 'dark' | 'light' | 'system' | 'user'

interface LocalStorageSchema {
  savedTabs: TabGroup[]
  parentCategories: ParentCategory[]
  customProjects: CustomProject[]
  customProjectOrder: string[]
  urls: UrlRecord[]
  viewMode: ViewMode
  userSettings: UserSettings
  domainCategorySettings: DomainCategorySettings[]
  domainCategoryMappings: DomainParentCategoryMapping[]
  urlsMigrationCompleted: boolean
  'tab-manager-theme': ThemePreference
  seenVersion: string
  changelogShown: boolean
}

type StorageSubset<K extends keyof LocalStorageSchema> = {
  [P in K]?: LocalStorageSchema[P]
}

declare global {
  namespace chrome.storage {
    interface LocalStorageArea {
      get(): Promise<Partial<LocalStorageSchema> & Record<string, unknown>>
      get(
        keys: null,
      ): Promise<Partial<LocalStorageSchema> & Record<string, unknown>>
      get<K extends keyof LocalStorageSchema>(
        keys: K,
      ): Promise<StorageSubset<K>>
      get<K extends keyof LocalStorageSchema>(
        keys: readonly K[],
      ): Promise<StorageSubset<K>>
      get<K extends keyof LocalStorageSchema>(
        keys: StorageSubset<K>,
      ): Promise<StorageSubset<K>>
      get<K extends string>(keys: K): Promise<Record<K, unknown>>
      get<K extends string>(
        keys: readonly K[],
      ): Promise<Partial<Record<K, unknown>>>
      get(keys: Record<string, unknown>): Promise<Record<string, unknown>>
      get(
        callback: (
          items: Partial<LocalStorageSchema> & Record<string, unknown>,
        ) => void,
      ): void
      get<K extends keyof LocalStorageSchema>(
        keys: K | readonly K[] | StorageSubset<K>,
        callback: (items: StorageSubset<K>) => void,
      ): void
      get<K extends string>(
        keys: K | readonly K[] | Record<K, unknown>,
        callback: (items: Partial<Record<K, unknown>>) => void,
      ): void
    }
  }
}
