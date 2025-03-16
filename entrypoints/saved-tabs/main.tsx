import "@/assets/global.css";
import { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import type {
	TabGroup,
	ParentCategory,
	UserSettings,
} from "../../utils/storage";
import {
	getUserSettings,
	getParentCategories,
	addSubCategoryToGroup,
	updateDomainCategorySettings,
	saveParentCategories,
	migrateParentCategoriesToDomainNames,
} from "../../utils/storage";
// 追加: 新しいユーティリティファイルからのインポート
import { handleTabGroupRemoval } from "../../utils/tab-operations";

import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
// lucide-reactからのアイコンインポート
import { Settings, Plus } from "lucide-react";

// UIコンポーネントのインポート
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	TooltipProvider,
} from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { SortableDomainCard } from "@/features/saved-tabs/components/SortableDomainCard";
import { CategoryGroup } from "@/features/saved-tabs/components/CategoryGroup";

const SavedTabs = () => {
	const [tabGroups, setTabGroups] = useState<TabGroup[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [settings, setSettings] = useState<UserSettings>({
		removeTabAfterOpen: false,
		excludePatterns: [],
		enableCategories: false,
		showSavedTime: false,
	});
	const [categories, setCategories] = useState<ParentCategory[]>([]);
	const [newSubCategory, setNewSubCategory] = useState("");
	const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
	const [showSubCategoryModal, setShowSubCategoryModal] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

	useEffect(() => {
		if (showSubCategoryModal && inputRef.current) {
			inputRef.current.focus();
		}
	}, [showSubCategoryModal]);

	// ページ読み込み時にマイグレーションを実行
	useEffect(() => {
		const loadSavedTabs = async () => {
			try {
				console.log("ページ読み込み時の親カテゴリ移行処理を開始...");

				// まずマイグレーションを実行
				try {
					await migrateParentCategoriesToDomainNames();
				} catch (error) {
					console.error("親カテゴリ移行エラー:", error);
				}

				// データ読み込み
				const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
				console.log("読み込まれたタブ:", savedTabs);
				setTabGroups(savedTabs);

				// ユーザー設定を読み込み
				const userSettings = await getUserSettings();
				setSettings(userSettings);

				// カテゴリを読み込み
				const parentCategories = await getParentCategories();
				console.log("読み込まれた親カテゴリ:", parentCategories);

				// カテゴリが空の場合、または無効なカテゴリがある場合
				const hasInvalidCategory = parentCategories.some(
					(cat) => !cat.domainNames || !Array.isArray(cat.domainNames),
				);

				if (hasInvalidCategory || parentCategories.length === 0) {
					console.log("無効なカテゴリを検出、再マイグレーションを実行");
					await migrateParentCategoriesToDomainNames();
					const updatedCategories = await getParentCategories();
					setCategories(updatedCategories);
				} else {
					setCategories(parentCategories);
				}
			} catch (error) {
				console.error("保存されたタブの読み込みエラー:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadSavedTabs();

		// ストレージが変更されたときに再読み込み
		chrome.storage.onChanged.addListener((changes) => {
			console.log("ストレージ変更を検出:", changes);
			if (changes.savedTabs) {
				setTabGroups(changes.savedTabs.newValue || []);
			}
			if (changes.userSettings) {
				setSettings((prev) => ({ ...prev, ...changes.userSettings.newValue }));
			}
			if (changes.parentCategories) {
				setCategories(changes.parentCategories.newValue || []);
			}
		});
	}, []);

	useEffect(() => {
		if (categories.length > 0) {
			setCategoryOrder(categories.map((cat) => cat.id));
		}
	}, [categories]);

	const handleOpenTab = async (url: string) => {
		window.open(url, "_blank");

		// 設定に基づいて、開いたタブを削除するかどうかを決定
		if (settings.removeTabAfterOpen) {
			// タブを開いた後に削除する処理
			const updatedGroups = tabGroups
				.map((group) => ({
					...group,
					urls: group.urls.filter((item) => item.url !== url),
				}))
				// 空のグループを削除
				.filter((group) => group.urls.length > 0);

			setTabGroups(updatedGroups);
			await chrome.storage.local.set({ savedTabs: updatedGroups });
		}
	};

	// handleOpenAllTabs関数も同様に修正
	const handleOpenAllTabs = async (urls: { url: string; title: string }[]) => {
		for (const { url } of urls) {
			window.open(url, "_blank");
			// 設定に基づいて、開いたタブグループを削除するかどうかを決定
			if (settings.removeTabAfterOpen) {
				// 開いたすべてのタブを含むグループを削除する処理
				const urlSet = new Set(urls.map((item) => item.url));

				// 削除前に各グループのカテゴリ設定を保存
				for (const group of tabGroups) {
					const remainingUrls = group.urls.filter(
						(item) => !urlSet.has(item.url),
					);

					if (remainingUrls.length === 0) {
						// 子カテゴリ設定を保存
						await updateDomainCategorySettings(
							group.domain,
							group.subCategories || [],
							group.categoryKeywords || [],
						);

						// 親カテゴリマッピングは削除せず保持する
						// 親カテゴリからドメインIDの削除は内部的に行われるので明示的に行わない
					}
				}

				// 従来通りの処理を続行
				const updatedGroups = tabGroups
					.map((group) => {
						// このグループのURLsを確認
						const remainingUrls = group.urls.filter(
							(item) => !urlSet.has(item.url),
						);

						if (remainingUrls.length === 0) {
							return null; // グループを削除
						}

						return {
							...group,
							urls: remainingUrls,
						};
					})
					.filter(Boolean) as TabGroup[];

				setTabGroups(updatedGroups);
				await chrome.storage.local.set({ savedTabs: updatedGroups });
			}
		}
	};

	// handleDeleteGroup関数を修正
	const handleDeleteGroup = async (id: string) => {
		try {
			// 削除前にカテゴリ設定と親カテゴリ情報を保存
			const groupToDelete = tabGroups.find((group) => group.id === id);
			if (groupToDelete) {
				console.log(`グループを削除: ${groupToDelete.domain}`);

				// 専用の削除前処理関数を呼び出し（インポートした関数を使用）
				await handleTabGroupRemoval(id);

				// 以降は従来通りの処理
				const updatedGroups = tabGroups.filter((group) => group.id !== id);
				setTabGroups(updatedGroups);
				await chrome.storage.local.set({ savedTabs: updatedGroups });

				// 親カテゴリからはドメインIDのみを削除（ドメイン名は保持）
				const updatedCategories = categories.map((category) => ({
					...category,
					domains: category.domains.filter((domainId) => domainId !== id),
				}));

				await saveParentCategories(updatedCategories);
				console.log("グループ削除処理が完了しました");
			}
		} catch (error) {
			console.error("グループ削除エラー:", error);
		}
	};

	const handleDeleteUrl = async (groupId: string, url: string) => {
		const updatedGroups = tabGroups
			.map((group) => {
				if (group.id === groupId) {
					const updatedUrls = group.urls.filter((item) => item.url !== url);
					if (updatedUrls.length === 0) {
						return null; // URLが0になったらグループを削除
					}
					return {
						...group,
						urls: updatedUrls,
					};
				}
				return group;
			})
			.filter(Boolean) as TabGroup[];
		setTabGroups(updatedGroups);
		await chrome.storage.local.set({ savedTabs: updatedGroups });
	};

	const handleUpdateUrls = async (
		groupId: string,
		updatedUrls: TabGroup["urls"],
	) => {
		const updatedGroups = tabGroups.map((group) => {
			if (group.id === groupId) {
				return {
					...group,
					urls: updatedUrls,
				};
			}
			return group;
		});

		setTabGroups(updatedGroups);
		await chrome.storage.local.set({ savedTabs: updatedGroups });
	};

	// 子カテゴリを追加
	const handleAddSubCategory = async () => {
		if (activeGroupId && newSubCategory.trim()) {
			try {
				await addSubCategoryToGroup(activeGroupId, newSubCategory.trim());
				setShowSubCategoryModal(false);
				setNewSubCategory("");
			} catch (error) {
				console.error("子カテゴリ追加エラー:", error);
			}
		}
	};

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			setTabGroups((groups) => {
				const oldIndex = groups.findIndex((group) => group.id === active.id);
				const newIndex = groups.findIndex((group) => group.id === over.id);

				const newGroups = arrayMove(groups, oldIndex, newIndex);

				// ストレージに保存
				chrome.storage.local.set({ savedTabs: newGroups });

				return newGroups;
			});
		}
	};

	// カテゴリの削除を処理する関数 - 改善版
	const handleDeleteCategory = async (
		groupId: string,
		categoryName: string,
	) => {
		try {
			console.log(`カテゴリ ${categoryName} の削除を開始します...`);

			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

			// 削除前にグループを取得して現在のカテゴリを確認
			const targetGroup = savedTabs.find(
				(group: TabGroup) => group.id === groupId,
			);
			if (!targetGroup) {
				console.error("カテゴリ削除対象のグループが見つかりません:", groupId);
				return;
			}

			const updatedGroups = savedTabs.map((group: TabGroup) => {
				if (group.id === groupId) {
					// 削除前と削除後のカテゴリ情報をログ
					console.log("削除前のサブカテゴリ:", group.subCategories);

					const updatedSubCategories =
						group.subCategories?.filter((cat) => cat !== categoryName) || [];

					console.log("削除後のサブカテゴリ:", updatedSubCategories);

					return {
						...group,
						subCategories: updatedSubCategories,
						categoryKeywords:
							group.categoryKeywords?.filter(
								(ck) => ck.categoryName !== categoryName,
							) || [],
						urls: group.urls.map((url) =>
							url.subCategory === categoryName
								? { ...url, subCategory: undefined }
								: url,
						),
					};
				}
				return group;
			});

			console.log(`カテゴリ ${categoryName} を削除します`);
			await chrome.storage.local.set({ savedTabs: updatedGroups });

			// 明示的に状態を更新
			setTabGroups(updatedGroups);

			console.log(`カテゴリ ${groupId} を削除しました`);
		} catch (error) {
			console.error("カテゴリ削除エラー:", error);
		}
	};

	// 親カテゴリの順序変更ハンドラを追加
	const handleCategoryDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			// カテゴリの順序を更新
			const oldIndex = categories.findIndex((cat) => cat.id === active.id);
			const newIndex = categories.findIndex((cat) => cat.id === over.id);

			if (oldIndex !== -1 && newIndex !== -1) {
				// 新しい順序を作成
				const newOrder = arrayMove(categoryOrder, oldIndex, newIndex);
				setCategoryOrder(newOrder);

				// 新しい順序に基づいてカテゴリを並び替え
				const orderedCategories = [...categories].sort(
					(a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id),
				);

				// ストレージに保存
				await saveParentCategories(orderedCategories);
				setCategories(orderedCategories);
			}
		}
	};

	// カテゴリ内のドメイン順序更新関数を改善
	const handleUpdateDomainsOrder = async (
		categoryId: string,
		updatedDomains: TabGroup[],
	) => {
		try {
			console.log("カテゴリ内のドメイン順序を更新:", categoryId);
			console.log(
				"更新後のドメイン順序:",
				updatedDomains.map((d) => d.domain),
			);

			// 更新するカテゴリを探す
			const targetCategory = categories.find((cat) => cat.id === categoryId);
			if (!targetCategory) {
				console.error("更新対象のカテゴリが見つかりません:", categoryId);
				return;
			}

			// 更新するドメインIDの配列を作成
			const updatedDomainIds = updatedDomains.map((domain) => domain.id);

			// カテゴリ内のドメイン順序を更新
			const updatedCategories = categories.map((category) => {
				if (category.id === categoryId) {
					return {
						...category,
						domains: updatedDomainIds,
					};
				}
				return category;
			});

			// ストレージに保存
			await saveParentCategories(updatedCategories);
			setCategories(updatedCategories);

			console.log("カテゴリ内のドメイン順序を更新しました:", categoryId);
		} catch (error) {
			console.error("カテゴリ内ドメイン順序更新エラー:", error);
		}
	};

	// タブグループをカテゴリごとに整理する関数を強化
	const organizeTabGroups = () => {
		if (!settings.enableCategories) {
			return { categorized: {}, uncategorized: tabGroups };
		}

		console.log("親カテゴリ一覧:", categories);
		console.log("タブグループ:", tabGroups);

		// カテゴリに属するドメインとカテゴリに属さないドメインに分ける
		const categorizedGroups: Record<string, TabGroup[]> = {};
		const uncategorizedGroups: TabGroup[] = [];

		for (const group of tabGroups) {
			// このグループが属するカテゴリを探す
			let found = false;

			// まずIDベースでカテゴリを検索
			for (const category of categories) {
				if (category.domains.includes(group.id)) {
					if (!categorizedGroups[category.id]) {
						categorizedGroups[category.id] = [];
					}
					categorizedGroups[category.id].push(group);
					found = true;
					console.log(
						`ドメイン ${group.domain} はIDベースで ${category.name} に分類されました`,
					);
					break;
				}
			}

			// IDで見つからなかった場合は、ドメイン名で検索
			if (!found) {
				for (const category of categories) {
					if (
						category.domainNames &&
						Array.isArray(category.domainNames) &&
						category.domainNames.includes(group.domain)
					) {
						if (!categorizedGroups[category.id]) {
							categorizedGroups[category.id] = [];
						}
						categorizedGroups[category.id].push(group);

						console.log(
							`ドメイン ${group.domain} はドメイン名ベースで ${category.name} に分類されました`,
						);

						// 見つかった場合、ドメインIDも更新して同期させる
						(async () => {
							try {
								const updatedCategory = {
									...category,
									domains: [...category.domains, group.id],
								};

								await saveParentCategories(
									categories.map((c) =>
										c.id === category.id ? updatedCategory : c,
									),
								);
								console.log(
									`ドメイン ${group.domain} のIDを親カテゴリに同期しました`,
								);
							} catch (err) {
								console.error("カテゴリ同期エラー:", err);
							}
						})();

						found = true;
						break;
					}
				}
			}

			if (!found) {
				uncategorizedGroups.push(group);
				console.log(`ドメイン ${group.domain} は未分類です`);
			}
		}

		// カテゴリ内のドメイン順序を維持するための処理を追加
		for (const categoryId of Object.keys(categorizedGroups)) {
			const category = categories.find((c) => c.id === categoryId);
			const domains = category?.domains;
			if (domains && domains.length > 0) {
				// ドメインIDの順序に従ってドメインをソート
				const domainArray = [...domains]; // 配列として扱うことを保証
				categorizedGroups[categoryId].sort((a, b) => {
					const indexA = domainArray.indexOf(a.id);
					const indexB = domainArray.indexOf(b.id);
					// 見つからない場合は最後に配置
					if (indexA === -1) return 1;
					if (indexB === -1) return -1;
					return indexA - indexB;
				});
			}
		}

		return {
			categorized: categorizedGroups,
			uncategorized: uncategorizedGroups,
		};
	};

	const { categorized, uncategorized } = organizeTabGroups();

	// ドメインを別のカテゴリに移動する関数
	const handleMoveDomainToCategory = async (
		domainId: string,
		fromCategoryId: string | null,
		toCategoryId: string,
	) => {
		try {
			// 移動するドメイングループを取得
			const domainGroup = tabGroups.find((group) => group.id === domainId);
			if (!domainGroup) return;

			// 更新するカテゴリのリストを準備
			let updatedCategories = [...categories];

			// 元のカテゴリからドメインIDを削除
			if (fromCategoryId) {
				updatedCategories = updatedCategories.map((cat) => {
					if (cat.id === fromCategoryId) {
						return {
							...cat,
							domains: cat.domains.filter((d) => d !== domainId),
							domainNames: cat.domainNames
								? cat.domainNames.filter((d) => d !== domainGroup.domain)
								: [],
						};
					}
					return cat;
				});
			}

			// 新しいカテゴリにドメインIDとドメイン名を追加
			updatedCategories = updatedCategories.map((cat) => {
				if (cat.id === toCategoryId) {
					// 既に含まれていなければ追加
					const containsDomain = cat.domains.includes(domainId);
					const containsDomainName = cat.domainNames
						? cat.domainNames.includes(domainGroup.domain)
						: false;

					return {
						...cat,
						domains: containsDomain ? cat.domains : [...cat.domains, domainId],
						domainNames: cat.domainNames
							? containsDomainName
								? cat.domainNames
								: [...cat.domainNames, domainGroup.domain]
							: [domainGroup.domain],
					};
				}
				return cat;
			});

			// 保存
			await saveParentCategories(updatedCategories);
			setCategories(updatedCategories);

			console.log(
				`ドメイン ${domainGroup.domain} を ${fromCategoryId || "未分類"} から ${toCategoryId} に移動しました`,
			);
		} catch (error) {
			console.error("カテゴリ間ドメイン移動エラー:", error);
		}
	};

	return (
		<>
			<Toaster />
			<div className="container mx-auto px-4 py-2 min-h-screen">
				<div className="flex justify-between items-center mb-4">
					<h1 className="text-3xl font-bold text-foreground">Tab Manager</h1>
					<div className="flex items-center gap-4">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									onClick={() => chrome.runtime.openOptionsPage()}
									className="flex items-center gap-2 cursor-pointer"
									title="設定"
								>
									<Settings size={16} />
									<span className="lg:inline hidden">設定</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent side="top" className="lg:hidden block">
								設定
							</TooltipContent>
						</Tooltip>
						<div className="text-sm text-muted-foreground space-x-4">
							<p>
								タブ:
								{tabGroups.reduce((sum, group) => sum + group.urls.length, 0)}
							</p>
							<p>ドメイン: {tabGroups.length}</p>
						</div>
					</div>
				</div>

				{isLoading ? (
					<div className="flex items-center justify-center min-h-[200px]">
						<div className="text-xl text-foreground">読み込み中...</div>
					</div>
				) : tabGroups.length === 0 ? (
					<div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
						<div className="text-2xl text-foreground">
							保存されたタブはありません
						</div>
						<div className="text-muted-foreground">
							タブを右クリックして保存するか、拡張機能のアイコンをクリックしてください
						</div>
					</div>
				) : (
					<>
						{settings.enableCategories &&
							Object.keys(categorized).length > 0 && (
								<>
									<DndContext
										sensors={sensors}
										collisionDetection={closestCenter}
										onDragEnd={handleCategoryDragEnd}
									>
										<SortableContext
											items={categoryOrder}
											strategy={verticalListSortingStrategy}
										>
											<div className="flex flex-col gap-1">
												{/* カテゴリ順序に基づいて表示 */}
												{categoryOrder.map((categoryId) => {
													if (!categoryId) return null;
													const category = categories.find(
														(c) => c.id === categoryId,
													);
													if (!category) return null;
													const domainGroups = categorized[categoryId] || [];
													if (domainGroups.length === 0) return null;

													return (
														<CategoryGroup
															key={categoryId}
															category={category}
															domains={domainGroups}
															handleOpenAllTabs={handleOpenAllTabs}
															handleDeleteGroup={handleDeleteGroup}
															handleDeleteUrl={handleDeleteUrl}
															handleOpenTab={handleOpenTab}
															handleUpdateUrls={handleUpdateUrls}
															handleUpdateDomainsOrder={
																handleUpdateDomainsOrder
															}
															handleMoveDomainToCategory={
																handleMoveDomainToCategory
															}
															handleDeleteCategory={handleDeleteCategory}
															settings={settings}
														/>
													);
												})}
											</div>
										</SortableContext>
									</DndContext>

									{uncategorized.length > 0 && (
										<h2 className="text-xl font-bold text-foreground mt-2 mb-1">
											未分類のドメイン
										</h2>
									)}
								</>
							)}

						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragEnd={handleDragEnd}
						>
							<SortableContext
								items={uncategorized.map((group) => group.id)}
								strategy={verticalListSortingStrategy}
							>
								<div className="flex flex-col gap-1">
									{uncategorized.map((group) => (
										<SortableDomainCard
											key={group.id}
											group={group}
											handleOpenAllTabs={handleOpenAllTabs}
											handleDeleteGroup={handleDeleteGroup}
											handleDeleteUrl={handleDeleteUrl}
											handleOpenTab={handleOpenTab}
											handleUpdateUrls={handleUpdateUrls}
											handleDeleteCategory={handleDeleteCategory}
											settings={settings} // settingsを渡す
										/>
									))}
								</div>
							</SortableContext>
						</DndContext>
					</>
				)}

				{/* 子カテゴリ追加モーダル */}
				{showSubCategoryModal && (
					<Dialog
						open={showSubCategoryModal}
						onOpenChange={setShowSubCategoryModal}
					>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>新しい子カテゴリを追加</DialogTitle>
							</DialogHeader>
							<Input
								value={newSubCategory}
								onChange={(e) => setNewSubCategory(e.target.value)}
								placeholder="カテゴリ名を入力"
								className="w-full p-2 border rounded mb-4 text-foreground"
								ref={inputRef}
							/>
							<DialogFooter>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="secondary"
											size="sm"
											onClick={() => setShowSubCategoryModal(false)}
											className="text-secondary-foreground px-2 py-1 rounded cursor-pointer"
											title="キャンセル"
										>
											キャンセル
										</Button>
									</TooltipTrigger>
									<TooltipContent side="top" className="lg:hidden block">
										キャンセル
									</TooltipContent>
								</Tooltip>

								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="default"
											size="sm"
											onClick={handleAddSubCategory}
											className="text-primary-foreground rounded flex items-center gap-1 cursor-pointer"
											title="追加"
										>
											<Plus size={14} />
											<span className="lg:inline hidden">追加</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent side="top" className="lg:hidden block">
										追加
									</TooltipContent>
								</Tooltip>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				)}
			</div>
		</>
	);
};

// Reactコンポーネントをレンダリング
document.addEventListener("DOMContentLoaded", () => {
	const appContainer = document.getElementById("app");
	if (!appContainer) throw new Error("Failed to find the app container");

	const root = createRoot(appContainer);
	root.render(
		<ThemeProvider defaultTheme="system" storageKey="tab-manager-theme">
			<TooltipProvider>
				<SavedTabs />
			</TooltipProvider>
		</ThemeProvider>,
	);
});
