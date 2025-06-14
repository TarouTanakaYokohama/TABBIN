import type {
  DomainCategorySettings,
  DomainParentCategoryMapping,
  ParentCategory,
  SubCategoryKeyword,
} from '@/types/storage'
import { v4 as uuidv4 } from 'uuid'

// 親カテゴリを取得する関数
export async function getParentCategories(): Promise<ParentCategory[]> {
  const { parentCategories = [] } =
    await chrome.storage.local.get('parentCategories')
  return parentCategories
}

// 親カテゴリを保存する関数
export async function saveParentCategories(
  categories: ParentCategory[],
): Promise<void> {
  await chrome.storage.local.set({ parentCategories: categories })
}

// 新しい親カテゴリを作成する関数
export async function createParentCategory(
  name: string,
): Promise<ParentCategory> {
  const categories = await getParentCategories()

  // 重複チェック: 同じ名前のカテゴリが既に存在するかを確認
  const duplicateCategory = categories.find(
    category => category.name.toLowerCase() === name.toLowerCase(),
  )
  if (duplicateCategory) {
    throw new Error(`DUPLICATE_CATEGORY_NAME:${name}`)
  }

  const newCategory: ParentCategory = {
    id: uuidv4(),
    name,
    domains: [],
    domainNames: [], // 空の配列で初期化
  }

  await saveParentCategories([...categories, newCategory])
  return newCategory
}

// ドメイン名でカテゴリを検索する関数を追加
export async function findCategoryByDomainName(
  domainName: string,
): Promise<ParentCategory | null> {
  const categories = await getParentCategories()
  return (
    categories.find(category => category.domainNames.includes(domainName)) ||
    null
  )
}

// ドメインのカテゴリ設定を取得する関数
export async function getDomainCategorySettings(): Promise<
  DomainCategorySettings[]
> {
  const { domainCategorySettings = [] } = await chrome.storage.local.get(
    'domainCategorySettings',
  )
  return domainCategorySettings
}

// ドメインのカテゴリ設定を保存する関数
export async function saveDomainCategorySettings(
  settings: DomainCategorySettings[],
): Promise<void> {
  await chrome.storage.local.set({ domainCategorySettings: settings })
}

// ドメインのカテゴリ設定を更新する関数
export async function updateDomainCategorySettings(
  domain: string,
  subCategories: string[],
  categoryKeywords: SubCategoryKeyword[],
): Promise<void> {
  const settings = await getDomainCategorySettings()

  // 既存の設定を探す
  const existingIndex = settings.findIndex(s => s.domain === domain)

  if (existingIndex >= 0) {
    // 既存の設定を更新
    settings[existingIndex] = {
      domain,
      subCategories,
      categoryKeywords,
    }
  } else {
    // 新しい設定を追加
    settings.push({
      domain,
      subCategories,
      categoryKeywords,
    })
  }

  await saveDomainCategorySettings(settings)
}

// ドメイン-親カテゴリのマッピングを取得する関数
export async function getDomainCategoryMappings(): Promise<
  DomainParentCategoryMapping[]
> {
  const { domainCategoryMappings = [] } = await chrome.storage.local.get(
    'domainCategoryMappings',
  )
  return domainCategoryMappings
}

// ドメイン-親カテゴリのマッピングを保存する関数
export async function saveDomainCategoryMappings(
  mappings: DomainParentCategoryMapping[],
): Promise<void> {
  await chrome.storage.local.set({ domainCategoryMappings: mappings })
}

// ドメイン-親カテゴリのマッピングを更新する関数
export async function updateDomainCategoryMapping(
  domain: string,
  categoryId: string | null,
): Promise<void> {
  const mappings = await getDomainCategoryMappings()

  // 既存のマッピングを探す
  const existingIndex = mappings.findIndex(m => m.domain === domain)

  if (categoryId === null) {
    // カテゴリIDがnullの場合は、マッピングを削除
    if (existingIndex >= 0) {
      mappings.splice(existingIndex, 1)
      await saveDomainCategoryMappings(mappings)
    }
    return
  }

  if (existingIndex >= 0) {
    // 既存のマッピングを更新
    mappings[existingIndex].categoryId = categoryId
  } else {
    // 新しいマッピングを追加
    mappings.push({ domain, categoryId })
  }

  await saveDomainCategoryMappings(mappings)
}

// 親カテゴリを削除する関数
export async function deleteParentCategory(categoryId: string): Promise<void> {
  try {
    // 現在のカテゴリリストを取得
    const categories = await getParentCategories()

    // 削除するカテゴリを見つける
    const categoryToDelete = categories.find(cat => cat.id === categoryId)
    if (!categoryToDelete) {
      throw new Error(`カテゴリID ${categoryId} が見つかりません`)
    }

    // このカテゴリに属しているドメイン名のリスト
    const affectedDomainNames = categoryToDelete.domainNames || []

    // カテゴリを除外したリストを作成
    const updatedCategories = categories.filter(cat => cat.id !== categoryId)

    // カテゴリリストを更新
    await saveParentCategories(updatedCategories)

    // このカテゴリに関連付けられていたすべてのドメインのマッピングを削除
    const mappings = await getDomainCategoryMappings()
    const updatedMappings = mappings.filter(
      mapping => mapping.categoryId !== categoryId,
    )

    // マッピングを更新
    await saveDomainCategoryMappings(updatedMappings)

    console.log(
      `親カテゴリ「${categoryToDelete.name}」を削除しました。影響を受けたドメイン: ${affectedDomainNames.join(', ')}`,
    )

    return
  } catch (error) {
    console.error('親カテゴリの削除に失敗しました:', error)
    throw error
  }
}
