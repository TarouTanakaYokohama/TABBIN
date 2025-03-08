import { v4 as uuidv4 } from "uuid";

// 親カテゴリのインターフェース
export interface ParentCategory {
	id: string;
	name: string;
	domains: string[]; // このカテゴリに属するドメインIDのリスト
}

// 子カテゴリのキーワード設定のインターフェース
export interface SubCategoryKeyword {
	categoryName: string; // カテゴリ名
	keywords: string[]; // 関連キーワードリスト
}

export interface TabGroup {
	id: string;
	domain: string;
	parentCategoryId?: string; // 親カテゴリのID
	urls: {
		url: string;
		title: string;
		subCategory?: string; // 子カテゴリ名
	}[];
	subCategories?: string[]; // このドメインで利用可能な子カテゴリのリスト
	categoryKeywords?: SubCategoryKeyword[]; // 子カテゴリのキーワード設定
}

export interface UserSettings {
	removeTabAfterOpen: boolean;
	excludePatterns: string[];
	enableCategories: boolean; // カテゴリ機能の有効/無効
}

// デフォルト設定
export const defaultSettings: UserSettings = {
	removeTabAfterOpen: true,
	excludePatterns: ["chrome-extension://", "chrome://"],
	enableCategories: false, // デフォルトは無効
};

// 設定を取得する関数
export async function getUserSettings(): Promise<UserSettings> {
	const { userSettings } = await chrome.storage.local.get("userSettings");
	return { ...defaultSettings, ...(userSettings || {}) };
}

// 設定を保存する関数
export async function saveUserSettings(settings: UserSettings): Promise<void> {
	await chrome.storage.local.set({ userSettings: settings });
}

// 親カテゴリを取得する関数
export async function getParentCategories(): Promise<ParentCategory[]> {
	const { parentCategories = [] } =
		await chrome.storage.local.get("parentCategories");
	return parentCategories;
}

// 親カテゴリを保存する関数
export async function saveParentCategories(
	categories: ParentCategory[],
): Promise<void> {
	await chrome.storage.local.set({ parentCategories: categories });
}

// 新しい親カテゴリを作成する関数
export async function createParentCategory(
	name: string,
): Promise<ParentCategory> {
	const categories = await getParentCategories();
	const newCategory: ParentCategory = {
		id: uuidv4(),
		name,
		domains: [],
	};

	await saveParentCategories([...categories, newCategory]);
	return newCategory;
}

// ドメインを親カテゴリに割り当てる関数
export async function assignDomainToCategory(
	domainId: string,
	categoryId: string,
): Promise<void> {
	const categories = await getParentCategories();
	const updatedCategories = categories.map((category: ParentCategory) => {
		if (category.id === categoryId) {
			// すでに含まれていなければ追加
			if (!category.domains.includes(domainId)) {
				return {
					...category,
					domains: [...category.domains, domainId],
				};
			}
		} else {
			// 他のカテゴリからは削除（重複を避けるため）
			return {
				...category,
				domains: category.domains.filter((id) => id !== domainId),
			};
		}
		return category;
	});

	await saveParentCategories(updatedCategories);
}

// 子カテゴリを追加する関数
export async function addSubCategoryToGroup(
	groupId: string,
	subCategoryName: string,
): Promise<void> {
	const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

	const updatedGroups = savedTabs.map((group: TabGroup) => {
		if (group.id === groupId) {
			const subCategories = group.subCategories || [];
			if (!subCategories.includes(subCategoryName)) {
				return {
					...group,
					subCategories: [...subCategories, subCategoryName],
				};
			}
		}
		return group;
	});

	await chrome.storage.local.set({ savedTabs: updatedGroups });
}

// URLに子カテゴリを設定する関数
export async function setUrlSubCategory(
	groupId: string,
	url: string,
	subCategory: string,
): Promise<void> {
	const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

	const updatedGroups = savedTabs.map((group: TabGroup) => {
		if (group.id === groupId) {
			const updatedUrls = group.urls.map((item) => {
				if (item.url === url) {
					return {
						...item,
						subCategory,
					};
				}
				return item;
			});

			return {
				...group,
				urls: updatedUrls,
			};
		}
		return group;
	});

	await chrome.storage.local.set({ savedTabs: updatedGroups });
}

// 子カテゴリにキーワードを設定する関数
export async function setCategoryKeywords(
	groupId: string,
	categoryName: string,
	keywords: string[],
): Promise<void> {
	const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

	const updatedGroups = savedTabs.map((group: TabGroup) => {
		if (group.id === groupId) {
			// 既存のカテゴリキーワード設定を取得
			const categoryKeywords = group.categoryKeywords || [];

			// 対象カテゴリのインデックスを探す
			const categoryIndex = categoryKeywords.findIndex(
				(ck) => ck.categoryName === categoryName,
			);

			if (categoryIndex >= 0) {
				// 既存カテゴリの更新
				categoryKeywords[categoryIndex] = {
					...categoryKeywords[categoryIndex],
					keywords,
				};
			} else {
				// 新規カテゴリの追加
				categoryKeywords.push({ categoryName, keywords });
			}

			return {
				...group,
				categoryKeywords,
			};
		}
		return group;
	});

	await chrome.storage.local.set({ savedTabs: updatedGroups });
}

// キーワードに基づいて自動的にURLを分類する
export async function autoCategorizeTabs(groupId: string): Promise<void> {
	const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

	const targetGroup = savedTabs.find((group: TabGroup) => group.id === groupId);
	if (
		!targetGroup ||
		!targetGroup.categoryKeywords ||
		targetGroup.categoryKeywords.length === 0
	) {
		return; // カテゴリキーワードがない場合は何もしない
	}

	const updatedUrls = targetGroup.urls.map((item: TabGroup["urls"][number]) => {
		// すでにカテゴリが設定されている場合はスキップ
		if (item.subCategory) return item;

		// タイトルをもとに適切なカテゴリを探す
		const title = item.title.toLowerCase();

		for (const catKeyword of targetGroup.categoryKeywords) {
			// いずれかのキーワードがタイトルに含まれているか確認
			const matchesKeyword = catKeyword.keywords.some((keyword: string) =>
				title.includes(keyword.toLowerCase()),
			);

			if (matchesKeyword) {
				return {
					...item,
					subCategory: catKeyword.categoryName,
				};
			}
		}

		return item; // マッチするキーワードがなければそのまま
	});

	// 更新されたURLを保存
	const updatedGroups = savedTabs.map((group: TabGroup) => {
		if (group.id === groupId) {
			return {
				...group,
				urls: updatedUrls,
			};
		}
		return group;
	});

	await chrome.storage.local.set({ savedTabs: updatedGroups });
}

// 新しい子カテゴリを追加時、キーワード設定も初期化する拡張版関数
export async function addSubCategoryWithKeywords(
	groupId: string,
	subCategoryName: string,
	keywords: string[] = [],
): Promise<void> {
	// 既存の子カテゴリ追加処理
	await addSubCategoryToGroup(groupId, subCategoryName);

	// キーワードがあれば設定
	if (keywords.length > 0) {
		await setCategoryKeywords(groupId, subCategoryName, keywords);
	}
}

export async function saveTabs(tabs: chrome.tabs.Tab[]) {
	const groupedTabs = new Map<string, TabGroup>();

	// 既存のタブグループを取得
	const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
	for (const group of savedTabs) {
		groupedTabs.set(group.domain, group);
	}

	// 新しいタブを適切なグループに振り分け
	for (const tab of tabs) {
		if (!tab.url) continue;

		// 拡張機能のURLは除外
		if (tab.url.startsWith("chrome-extension://")) continue;

		try {
			const url = new URL(tab.url);
			const domain = `${url.protocol}//${url.hostname}`;

			if (!groupedTabs.has(domain)) {
				groupedTabs.set(domain, {
					id: uuidv4(),
					domain,
					urls: [],
					subCategories: [], // 空の子カテゴリリストを初期化
				});
			}

			const group = groupedTabs.get(domain);
			if (!group) continue;

			// URLが既に存在するかチェック
			const urlExists = group.urls.some(
				(existingUrl) => existingUrl.url === tab.url,
			);
			if (!urlExists) {
				group.urls.push({
					url: tab.url,
					title: tab.title || "",
					subCategory: undefined, // 初期値は未分類
				});
			}
		} catch (error) {
			console.error(`Invalid URL: ${tab.url}`, error);
		}
	}

	// ストレージに保存
	await chrome.storage.local.set({
		savedTabs: Array.from(groupedTabs.values()),
	});
}

// タブ保存時に自動分類も行うようにsaveTabsを拡張
export async function saveTabsWithAutoCategory(tabs: chrome.tabs.Tab[]) {
	await saveTabs(tabs);

	// 保存したタブグループのIDを取得
	const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
	const uniqueDomains = new Set(
		tabs
			.map((tab) => {
				try {
					const url = new URL(tab.url || "");
					return `${url.protocol}//${url.hostname}`;
				} catch {
					return null;
				}
			})
			.filter(Boolean),
	);

	// 各ドメインで自動カテゴライズを実行
	for (const domain of uniqueDomains) {
		const group = savedTabs.find((g: TabGroup) => g.domain === domain);
		if (group?.categoryKeywords?.length > 0) {
			await autoCategorizeTabs(group.id);
		}
	}
}
