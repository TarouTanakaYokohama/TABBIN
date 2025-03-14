import { v4 as uuidv4 } from "uuid";

// 親カテゴリのインターフェース
export interface ParentCategory {
	id: string;
	name: string;
	domains: string[]; // このカテゴリに属するドメインIDのリスト
	domainNames: string[]; // このカテゴリに属するドメイン名のリスト (新規追加)
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
		savedAt?: number; // 個別のURL保存時刻を追加
	}[];
	subCategories?: string[]; // このドメインで利用可能な子カテゴリのリスト
	categoryKeywords?: SubCategoryKeyword[]; // 子カテゴリのキーワード設定
	subCategoryOrder?: string[]; // 子カテゴリの表示順序
	subCategoryOrderWithUncategorized?: string[]; // 未分類カテゴリを含む全カテゴリの表示順序
	savedAt?: number; // グループ全体の保存時刻を追加
}

export interface UserSettings {
	removeTabAfterOpen: boolean;
	excludePatterns: string[];
	enableCategories: boolean; // カテゴリ機能の有効/無効
	autoDeletePeriod?: string; // never, 1hour, 1day, 7days, 14days, 30days, 180days, 365days
	showSavedTime: boolean; // 保存日時を表示するかどうか
}

// デフォルト設定
export const defaultSettings: UserSettings = {
	removeTabAfterOpen: true,
	excludePatterns: ["chrome-extension://", "chrome://"],
	enableCategories: true, // デフォルトは無効
	autoDeletePeriod: "never", // デフォルトでは自動削除しない
	showSavedTime: false, // デフォルトでは表示しない
};

// 設定を取得する関数
export async function getUserSettings(): Promise<UserSettings> {
	try {
		console.log("ユーザー設定を取得中...");
		const data = await chrome.storage.local.get(["userSettings"]);
		console.log("取得した設定データ:", data);

		if (data.userSettings) {
			console.log("保存された設定を使用:", data.userSettings);
			// デフォルト値とマージして返す
			return { ...defaultSettings, ...data.userSettings };
		} else {
			console.log("設定が見つからないためデフォルト値を使用");
			return { ...defaultSettings };
		}
	} catch (error) {
		console.error("設定取得エラー:", error);
		return { ...defaultSettings };
	}
}

// 設定を保存する関数
export async function saveUserSettings(settings: UserSettings): Promise<void> {
	try {
		console.log("ユーザー設定を保存:", settings);
		await chrome.storage.local.set({ userSettings: settings });
		console.log("設定を保存しました");
	} catch (error) {
		console.error("設定保存エラー:", error);
		throw error;
	}
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
		domainNames: [], // 空の配列で初期化
	};

	await saveParentCategories([...categories, newCategory]);
	return newCategory;
}

// ドメイン名でカテゴリを検索する関数を追加
export async function findCategoryByDomainName(
	domainName: string,
): Promise<ParentCategory | null> {
	const categories = await getParentCategories();
	return (
		categories.find((category) => category.domainNames.includes(domainName)) ||
		null
	);
}

// ドメインを親カテゴリに割り当てる関数
export async function assignDomainToCategory(
	domainId: string,
	categoryId: string,
): Promise<void> {
	const categories = await getParentCategories();
	const tabGroup = await getTabGroupById(domainId);

	// ドメイン-カテゴリのマッピングも更新
	if (tabGroup) {
		// カテゴリが"none"でなければマッピングを更新
		if (categoryId !== "none") {
			await updateDomainCategoryMapping(tabGroup.domain, categoryId);
		} else {
			// "none"の場合はマッピングを削除
			await updateDomainCategoryMapping(tabGroup.domain, null);
		}
	}

	const updatedCategories = categories.map((category: ParentCategory) => {
		if (category.id === categoryId) {
			// すでに含まれていなければ追加
			if (!category.domains.includes(domainId)) {
				return {
					...category,
					domains: [...category.domains, domainId],
					domainNames: category.domainNames?.includes(tabGroup?.domain ?? "")
						? category.domainNames
						: [...(category.domainNames || []), tabGroup?.domain ?? ""],
				};
			}
		} else {
			// 他のカテゴリからは削除（重複を避けるため）
			return {
				...category,
				domains: category.domains.filter((id) => id !== domainId),
				domainNames: (category.domainNames || []).filter((domain) =>
					tabGroup ? domain !== tabGroup.domain : true,
				),
			};
		}
		return category;
	});

	await saveParentCategories(updatedCategories);
}

// ドメイン別のカテゴリ設定を保存するためのインターフェース
export interface DomainCategorySettings {
	domain: string; // ドメイン
	subCategories: string[]; // このドメインで設定された子カテゴリリスト
	categoryKeywords: SubCategoryKeyword[]; // カテゴリキーワード設定
}

// ドメインのカテゴリ設定を取得する関数
export async function getDomainCategorySettings(): Promise<
	DomainCategorySettings[]
> {
	const { domainCategorySettings = [] } = await chrome.storage.local.get(
		"domainCategorySettings",
	);
	return domainCategorySettings;
}

// ドメインのカテゴリ設定を保存する関数
export async function saveDomainCategorySettings(
	settings: DomainCategorySettings[],
): Promise<void> {
	await chrome.storage.local.set({ domainCategorySettings: settings });
}

// ドメインのカテゴリ設定を更新する関数
export async function updateDomainCategorySettings(
	domain: string,
	subCategories: string[],
	categoryKeywords: SubCategoryKeyword[],
): Promise<void> {
	const settings = await getDomainCategorySettings();

	// 既存の設定を探す
	const existingIndex = settings.findIndex((s) => s.domain === domain);

	if (existingIndex >= 0) {
		// 既存の設定を更新
		settings[existingIndex] = {
			domain,
			subCategories,
			categoryKeywords,
		};
	} else {
		// 新しい設定を追加
		settings.push({
			domain,
			subCategories,
			categoryKeywords,
		});
	}

	await saveDomainCategorySettings(settings);
}

// 子カテゴリを追加する関数（永続設定にも保存）
export async function addSubCategoryToGroup(
	groupId: string,
	subCategoryName: string,
): Promise<void> {
	const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

	const group = savedTabs.find((g: TabGroup) => g.id === groupId);
	if (!group) return;

	const updatedGroups = savedTabs.map((existingGroup: TabGroup) => {
		if (existingGroup.id === groupId) {
			const subCategories = existingGroup.subCategories || [];
			if (!subCategories.includes(subCategoryName)) {
				return {
					...group,
					subCategories: [...subCategories, subCategoryName],
				};
			}
		}
		return group;
	});

	// タブグループの更新
	await chrome.storage.local.set({ savedTabs: updatedGroups });

	// ドメイン別設定にも保存して永続化
	if (group) {
		const settings = await getDomainCategorySettings();
		const existingSetting = settings.find((s) => s.domain === group.domain);

		if (existingSetting) {
			// 既存の設定がある場合は更新
			if (!existingSetting.subCategories.includes(subCategoryName)) {
				existingSetting.subCategories.push(subCategoryName);
				await saveDomainCategorySettings(settings);
			}
		} else {
			// 新しい設定を作成
			settings.push({
				domain: group.domain,
				subCategories: [subCategoryName],
				categoryKeywords: [],
			});
			await saveDomainCategorySettings(settings);
		}
	}
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

// 子カテゴリにキーワードを設定する関数（永続設定にも保存）
export async function setCategoryKeywords(
	groupId: string,
	categoryName: string,
	keywords: string[],
): Promise<void> {
	const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

	const group = savedTabs.find((g: TabGroup) => g.id === groupId);
	if (!group) return;

	// 更新するグループを見つける
	const updatedGroups = savedTabs.map((currentGroup: TabGroup) => {
		if (currentGroup.id === groupId) {
			// 既存のカテゴリキーワード設定を取得
			const categoryKeywords = currentGroup.categoryKeywords || [];

			// 対象カテゴリのインデックスを探す
			const categoryIndex = categoryKeywords.findIndex(
				(ck: SubCategoryKeyword) => ck.categoryName === categoryName,
			);

			const updatedCategoryKeywords = [...categoryKeywords];

			if (categoryIndex >= 0) {
				// 既存カテゴリの更新
				updatedCategoryKeywords[categoryIndex] = {
					...updatedCategoryKeywords[categoryIndex],
					keywords,
				};
			} else {
				// 新規カテゴリの追加
				updatedCategoryKeywords.push({ categoryName, keywords });
			}

			// グループを更新（URLsはそのまま保持）
			return {
				...currentGroup,
				categoryKeywords: updatedCategoryKeywords,
			};
		}
		return currentGroup; // 対象外のグループはそのまま返す
	});

	// タブグループの更新
	await chrome.storage.local.set({ savedTabs: updatedGroups });

	// ドメイン別設定にも保存して永続化
	if (group) {
		const settings = await getDomainCategorySettings();
		const existingSetting = settings.find((s) => s.domain === group.domain);

		if (existingSetting) {
			// 既存の設定がある場合は更新
			const keywordIndex = existingSetting.categoryKeywords.findIndex(
				(ck) => ck.categoryName === categoryName,
			);

			if (keywordIndex >= 0) {
				// 既存のキーワード設定を更新
				existingSetting.categoryKeywords[keywordIndex].keywords = keywords;
			} else {
				// 新しいキーワード設定を追加
				existingSetting.categoryKeywords.push({
					categoryName,
					keywords,
				});
			}

			await saveDomainCategorySettings(settings);
		} else {
			// 新しい設定を作成
			settings.push({
				domain: group.domain,
				subCategories: group.subCategories || [],
				categoryKeywords: [{ categoryName, keywords }],
			});
			await saveDomainCategorySettings(settings);
		}
	}

	// キーワードが更新されたら、既存の全タブに対して自動的に再カテゴライズを実行
	await autoCategorizeTabs(groupId);
}

// キーワードに基づいて自動的にURLを分類する
export async function autoCategorizeTabs(groupId: string): Promise<void> {
	const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

	// 重複チェックを追加
	const uniqueIds = new Set<string>();
	const uniqueGroups: TabGroup[] = [];

	for (const group of savedTabs) {
		if (!uniqueIds.has(group.id)) {
			uniqueIds.add(group.id);
			uniqueGroups.push(group);
		} else {
			console.warn(
				`自動カテゴリ実行前に重複検出: ${group.id} (${group.domain})`,
			);
		}
	}

	// 重複があれば修正
	if (uniqueGroups.length < savedTabs.length) {
		console.log(
			`カテゴリ処理前に重複を修正: ${savedTabs.length} → ${uniqueGroups.length}`,
		);
	}

	const targetGroup = uniqueGroups.find(
		(group: TabGroup) => group.id === groupId,
	);
	if (
		!targetGroup ||
		!targetGroup.categoryKeywords ||
		targetGroup.categoryKeywords.length === 0
	) {
		console.log("カテゴリキーワードがないか、グループが見つかりません");
		return; // カテゴリキーワードがない場合は何もしない
	}

	// この時点でtargetGroup.categoryKeywordsは必ず存在する
	const categoryKeywords = targetGroup.categoryKeywords;

	// 各URLに適切なカテゴリを割り当て
	const updatedUrls = targetGroup.urls.map((item: TabGroup["urls"][number]) => {
		// タイトルをもとに適切なカテゴリを探す
		const title = item.title.toLowerCase();

		for (const catKeyword of categoryKeywords) {
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
	const updatedGroups = uniqueGroups.map((group: TabGroup) => {
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

// 既存の設定を新しいタブグループに復元する関数
export async function restoreCategorySettings(
	tabGroup: TabGroup,
): Promise<TabGroup> {
	const settings = await getDomainCategorySettings();
	const domainSettings = settings.find((s) => s.domain === tabGroup.domain);

	if (domainSettings) {
		return {
			...tabGroup,
			subCategories: domainSettings.subCategories,
			categoryKeywords: domainSettings.categoryKeywords,
		};
	}

	return tabGroup;
}

// ドメインと親カテゴリのマッピングを保存するインターフェース
export interface DomainParentCategoryMapping {
	domain: string; // ドメイン（URL）
	categoryId: string; // 親カテゴリID
}

// ドメイン-親カテゴリのマッピングを取得する関数
export async function getDomainCategoryMappings(): Promise<
	DomainParentCategoryMapping[]
> {
	const { domainCategoryMappings = [] } = await chrome.storage.local.get(
		"domainCategoryMappings",
	);
	return domainCategoryMappings;
}

// ドメイン-親カテゴリのマッピングを保存する関数
export async function saveDomainCategoryMappings(
	mappings: DomainParentCategoryMapping[],
): Promise<void> {
	await chrome.storage.local.set({ domainCategoryMappings: mappings });
}

// ドメイン-親カテゴリのマッピングを更新する関数
export async function updateDomainCategoryMapping(
	domain: string,
	categoryId: string | null,
): Promise<void> {
	const mappings = await getDomainCategoryMappings();

	// 既存のマッピングを探す
	const existingIndex = mappings.findIndex((m) => m.domain === domain);

	if (categoryId === null) {
		// カテゴリIDがnullの場合は、マッピングを削除
		if (existingIndex >= 0) {
			mappings.splice(existingIndex, 1);
			await saveDomainCategoryMappings(mappings);
		}
		return;
	}

	if (existingIndex >= 0) {
		// 既存のマッピングを更新
		mappings[existingIndex].categoryId = categoryId;
	} else {
		// 新しいマッピングを追加
		mappings.push({ domain, categoryId });
	}

	await saveDomainCategoryMappings(mappings);
}

// TabGroup IDからグループを取得する関数
async function getTabGroupById(groupId: string): Promise<TabGroup | null> {
	const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
	return savedTabs.find((group: TabGroup) => group.id === groupId) || null;
}

// saveTabs関数の実装（1つだけ残す）
export async function saveTabs(tabs: chrome.tabs.Tab[]) {
	console.log("タブを保存します:", tabs.length);

	// 既存のタブグループを取得
	const groupedTabs = new Map<string, TabGroup>();
	const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

	// 既存のタブグループをIDではなくドメインをキーにしてMapに保存
	for (const group of savedTabs) {
		groupedTabs.set(group.domain, group);
	}

	// 重複チェックのためのデバッグログ
	console.log("既存タブグループ数:", savedTabs.length);
	console.log("重複除外済みタブグループ数:", groupedTabs.size);

	// ドメインカテゴリマッピングを取得
	const domainCategoryMappings = await getDomainCategoryMappings();
	console.log("ドメインマッピング:", domainCategoryMappings);

	// 親カテゴリを取得
	const parentCategories = await getParentCategories();
	console.log("親カテゴリ一覧:", parentCategories);

	// デバッグ用にカテゴリのdomainNamesを出力
	for (const category of parentCategories) {
		console.log(
			`カテゴリ「${category.name}」のドメイン名一覧:`,
			category.domainNames || [],
		);
	}

	// domainNames配列が空のカテゴリがあれば緊急マイグレーション実行
	const hasEmptyDomainNames = parentCategories.some(
		(cat) => !cat.domainNames || cat.domainNames.length === 0,
	);
	if (hasEmptyDomainNames) {
		console.log("空のdomainNames配列を検出、緊急マイグレーションを実行");
		await migrateParentCategoriesToDomainNames();
		// 更新された親カテゴリを再取得
		const updatedCategories = await getParentCategories();
		console.log("マイグレーション後の親カテゴリ:", updatedCategories);
	}

	// 新しいタブを適切なグループに振り分け
	for (const tab of tabs) {
		if (!tab.url) continue;
		if (tab.url.startsWith("chrome-extension://")) continue;

		try {
			const url = new URL(tab.url);
			const domain = `${url.protocol}//${url.hostname}`;

			// 重複のチェックとログ出力を追加
			if (groupedTabs.has(domain)) {
				console.log(`既存のドメインに追加: ${domain}`);
			} else {
				console.log(`新しいドメインを処理: ${domain}`);

				// 新しいグループを作成
				const newGroup: TabGroup = {
					id: uuidv4(),
					domain,
					urls: [],
					subCategories: [],
					savedAt: Date.now(), // グループ全体の保存時刻を追加
				};

				// 既存の子カテゴリ設定を復元
				const restoredGroup = await restoreCategorySettings(newGroup);

				// このドメインが所属する親カテゴリを探す
				let foundCategory = null;
				let categoryFoundMethod = "";

				// マッピングでまず検索（最も優先度が高い）
				const domainMapping = domainCategoryMappings.find(
					(m) => m.domain === domain,
				);
				if (domainMapping) {
					foundCategory = parentCategories.find(
						(c) => c.id === domainMapping.categoryId,
					);
					if (foundCategory) {
						console.log(
							`ドメイン ${domain} は親カテゴリ「${foundCategory.name}」のマッピングに見つかりました`,
						);
						categoryFoundMethod = "mapping";
					}
				}

				// マッピングで見つからない場合、domainNamesで検索
				if (!foundCategory) {
					for (const category of parentCategories) {
						// nullチェックとArrayチェックを追加
						if (!category.domainNames || !Array.isArray(category.domainNames)) {
							console.log(
								`カテゴリ「${category.name}」のdomainNamesが不正です`,
							);
							continue;
						}

						console.log(`カテゴリ「${category.name}」のdomainNamesで検索:`, {
							domainNames: category.domainNames,
							searchDomain: domain,
						});

						// 厳密な比較で検索する
						if (category.domainNames.some((d) => d === domain)) {
							console.log(
								`ドメイン ${domain} は親カテゴリ「${category.name}」のdomainNamesに見つかりました`,
							);
							foundCategory = category;
							categoryFoundMethod = "domainNames";
							break;
						}
					}
				}

				// 親カテゴリが見つかった場合、グループに割り当てて更新
				if (foundCategory) {
					console.log(
						`ドメイン ${domain} を親カテゴリ「${foundCategory.name}」に割り当てます (検出方法: ${categoryFoundMethod})`,
					);

					restoredGroup.parentCategoryId = foundCategory.id;

					// 親カテゴリにこの新しいグループを追加
					const updatedCategory = {
						...foundCategory,
						domains: [...foundCategory.domains, restoredGroup.id],
					};

					// domainNamesにドメインを確実に追加
					if (!updatedCategory.domainNames) {
						updatedCategory.domainNames = [domain];
					} else if (!updatedCategory.domainNames.includes(domain)) {
						updatedCategory.domainNames = [
							...updatedCategory.domainNames,
							domain,
						];
					}

					// 親カテゴリを更新
					await updateCategoryDomains(updatedCategory);
					console.log(`親カテゴリ「${foundCategory.name}」を更新しました`);

					// ドメインカテゴリのマッピングも更新
					await updateDomainCategoryMapping(domain, foundCategory.id);
					console.log(
						`ドメイン ${domain} と親カテゴリのマッピングを更新しました`,
					);
				} else {
					console.log(
						`ドメイン ${domain} の親カテゴリが見つからないため未分類です`,
					);
				}

				groupedTabs.set(domain, restoredGroup);
			}

			// グループにURLを追加
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
					subCategory: undefined,
					savedAt: Date.now(), // 個別のURL保存時刻を追加
				});
			}
		} catch (error) {
			console.error(`Invalid URL: ${tab.url}`, error);
		}
	}

	// ストレージに保存（重複がないことを確認）
	const groupArray = Array.from(groupedTabs.values());
	console.log("保存前の重複チェック:", groupArray.length);

	// 重複IDがないかチェック
	const idSet = new Set<string>();
	const uniqueGroups = groupArray.filter((group) => {
		if (idSet.has(group.id)) {
			console.warn(`重複ID検出: ${group.id} (${group.domain})`);
			return false;
		}
		idSet.add(group.id);
		return true;
	});

	console.log("重複除去後のタブグループ数:", uniqueGroups.length);
	await chrome.storage.local.set({ savedTabs: uniqueGroups });

	// 保存したすべてのグループに自動カテゴライズを適用
	for (const group of uniqueGroups) {
		if (group.categoryKeywords && group.categoryKeywords.length > 0) {
			await autoCategorizeTabs(group.id);
		}
	}
}

// 既存のデータを更新し、domainNamesプロパティを追加する移行関数
export async function migrateParentCategoriesToDomainNames(): Promise<void> {
	try {
		console.log("親カテゴリのdomainNames移行を緊急実行します");
		const categories = await getParentCategories();
		const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
		const { domainCategoryMappings = [] } = await chrome.storage.local.get(
			"domainCategoryMappings",
		);

		console.log("現在の親カテゴリ:", categories);
		console.log("現在のタブグループ数:", savedTabs.length);
		console.log("現在のドメインマッピング数:", domainCategoryMappings.length);

		// 各カテゴリの状態をログ出力
		for (const category of categories) {
			console.log(`カテゴリ「${category.name}」の状態:`, {
				id: category.id,
				domains: category.domains,
				domainNames: category.domainNames || [],
			});

			// マッピングから検索
			const mappingsForCategory = domainCategoryMappings.filter(
				(m: DomainParentCategoryMapping) => m.categoryId === category.id,
			);
			console.log(
				`  マッピングから見つかったドメイン: ${mappingsForCategory
					.map((m: DomainParentCategoryMapping) => m.domain)
					.join(", ")}`,
			);

			// savedTabsからドメイン名を検索
			const domainsFromTabs = [];
			for (const domainId of category.domains) {
				const tab = savedTabs.find((t: TabGroup) => t.id === domainId);
				if (tab) {
					domainsFromTabs.push(tab.domain);
				}
			}
			console.log(
				`  タブから見つかったドメイン: ${domainsFromTabs.join(", ")}`,
			);
		}

		// マイグレーション実行
		const updatedCategories = categories.map((category) => {
			// ドメインIDに対応するドメイン名を取得
			const domainNames = category.domains
				.map((domainId) => {
					const group = savedTabs.find((tab: TabGroup) => tab.id === domainId);
					return group?.domain;
				})
				.filter(Boolean) as string[];

			// マッピングからもドメイン名を取得
			const mappingDomains = domainCategoryMappings
				.filter(
					(mapping: DomainParentCategoryMapping) =>
						mapping.categoryId === category.id,
				)
				.map((mapping: DomainParentCategoryMapping) => mapping.domain);

			// 既存のdomainNamesと結合して重複排除
			const allDomains = Array.from(
				new Set([
					...(category.domainNames || []),
					...domainNames,
					...mappingDomains,
				]),
			);

			console.log(
				`カテゴリ「${category.name}」の更新後domainNames:`,
				allDomains,
			);

			// 強制的にdomainNamesを上書き
			return {
				...category,
				domainNames: allDomains,
			};
		});

		console.log("更新後の親カテゴリ:", updatedCategories);

		// ストレージに保存
		await chrome.storage.local.set({ parentCategories: updatedCategories });
		console.log("親カテゴリのdomainNames移行が完了しました");

		// 確認のため保存後のデータも取得
		const savedCategories = await getParentCategories();
		console.log("保存後の親カテゴリ:", savedCategories);

		return;
	} catch (error) {
		console.error("親カテゴリ移行エラー:", error);
		throw error;
	}
}

// タブを開いた後のグループ削除処理を修正
export async function handleTabGroupRemoval(id: string): Promise<void> {
	try {
		// 削除前にドメイン情報を保存
		const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
		const groupToRemove = savedTabs.find((group: TabGroup) => group.id === id);

		if (groupToRemove?.domain) {
			console.log(`グループ削除前の処理: ${groupToRemove.domain}`);

			// カテゴリ設定を永続化
			await updateDomainCategorySettings(
				groupToRemove.domain,
				groupToRemove.subCategories || [],
				groupToRemove.categoryKeywords || [],
			);

			// 親カテゴリにドメイン名を確実に保持させる
			if (groupToRemove.parentCategoryId) {
				const parentCategories = await getParentCategories();
				const parentCategory = parentCategories.find(
					(cat) => cat.id === groupToRemove.parentCategoryId,
				);

				if (parentCategory) {
					// domainNamesが存在し、このドメイン名を含んでいるか確認
					const hasDomainName = parentCategory.domainNames?.includes(
						groupToRemove.domain,
					);

					if (!hasDomainName) {
						// ドメイン名を追加
						const updatedCategory = {
							...parentCategory,
							domainNames: [
								...(parentCategory.domainNames || []),
								groupToRemove.domain,
							],
						};

						// 親カテゴリを更新
						await saveParentCategories(
							parentCategories.map((cat) =>
								cat.id === groupToRemove.parentCategoryId
									? updatedCategory
									: cat,
							),
						);
						console.log(
							`ドメイン ${groupToRemove.domain} を親カテゴリのdomainNamesに追加しました`,
						);
					}
				}
			}

			// ドメイン-カテゴリマッピングも保持
			if (groupToRemove.parentCategoryId) {
				await updateDomainCategoryMapping(
					groupToRemove.domain,
					groupToRemove.parentCategoryId,
				);
				console.log(
					`ドメイン ${groupToRemove.domain} のマッピングを更新しました`,
				);
			}
		}

		return;
	} catch (error) {
		console.error("タブグループの削除処理中にエラーが発生:", error);
	}
}

// タブ保存時に自動分類も行うようにsaveTabsを拡張
export async function saveTabsWithAutoCategory(tabs: chrome.tabs.Tab[]) {
	const currentTime = Date.now(); // 現在時刻をミリ秒で取得
	await saveTabs(tabs);

	// 保存したタブグループのIDを取得
	const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

	// 重複チェックを追加
	const uniqueIds = new Set<string>();
	const uniqueGroups: TabGroup[] = [];

	for (const group of savedTabs) {
		if (!uniqueIds.has(group.id)) {
			uniqueIds.add(group.id);
			uniqueGroups.push(group);
		} else {
			console.warn(`重複グループを検出: ${group.id} (${group.domain})`);
		}
	}

	// 重複があれば修正して保存
	if (uniqueGroups.length < savedTabs.length) {
		console.log(`重複を修正: ${savedTabs.length} → ${uniqueGroups.length}`);
		await chrome.storage.local.set({ savedTabs: uniqueGroups });
	}

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
		const group = uniqueGroups.find((g: TabGroup) => g.domain === domain);
		if (group?.categoryKeywords?.length && group) {
			await autoCategorizeTabs(group.id);
		}
	}
}

// 親カテゴリの domains と domainNames を更新する関数
async function updateCategoryDomains(category: ParentCategory): Promise<void> {
	const categories = await getParentCategories();
	const updatedCategories = categories.map((c) =>
		c.id === category.id ? category : c,
	);
	await saveParentCategories(updatedCategories);
}
