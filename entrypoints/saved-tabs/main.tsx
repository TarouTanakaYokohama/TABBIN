import "@/assets/global.css"; // tailwind.cssの代わりにglobals.cssをインポート
import { useEffect, useState, useRef, useCallback } from "react";
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
	setUrlSubCategory,
	setCategoryKeywords,
	updateDomainCategorySettings,
	saveParentCategories,
	migrateParentCategoriesToDomainNames,
} from "../../utils/storage";
// 追加: 新しいユーティリティファイルからのインポート
import { handleTabGroupRemoval } from "../../utils/tab-operations";
import { formatDatetime, TimeRemaining } from "../../utils/datetime";

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
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// lucide-reactからのアイコンインポート
import {
	GripVertical,
	ExternalLink,
	Trash,
	Settings,
	X,
	Plus,
} from "lucide-react";

// タイプのインポート
import type {
	CategoryGroupProps,
	SortableDomainCardProps,
	SortableCategorySectionProps,
	CategorySectionProps,
	SortableUrlItemProps,
	UrlListProps,
	CategoryKeywordModalProps
} from "../../types/saved-tabs";

// UIコンポーネントのインポート
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { handleSaveKeywords } from "@/utils/handleSaveKeywords";

// カテゴリグループコンポーネント
const CategoryGroup = ({
	category,
	domains,
	handleOpenAllTabs,
	handleDeleteGroup,
	handleDeleteUrl,
	handleOpenTab,
	handleUpdateUrls,
	handleUpdateDomainsOrder,
	handleMoveDomainToCategory,
	handleDeleteCategory,
	settings,
}: CategoryGroupProps) => {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [isDraggingOver, setIsDraggingOver] = useState(false);
	// ドメインの状態を追加
	const [localDomains, setLocalDomains] = useState<TabGroup[]>(domains);

	// useSortableフックを使用してドラッグ機能を追加
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({ id: category.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	// ドメインの変更を検知して更新
	useEffect(() => {
		setLocalDomains(domains);
	}, [domains]);

	// このカテゴリ内のすべてのURLを取得
	const allUrls = domains.flatMap((group) => group.urls);

	// ドラッグ&ドロップのためのセンサー
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	// ドラッグオーバー時の処理を追加
	const handleDragOver = (event: React.DragEvent) => {
		event.preventDefault();
		setIsDraggingOver(true);
	};

	// ドラッグリーブ時の処理
	const handleDragLeave = () => {
		setIsDraggingOver(false);
	};

	// ドロップ時の処理
	const handleDrop = (event: React.DragEvent) => {
		event.preventDefault();
		setIsDraggingOver(false);

		const domainId = event.dataTransfer.getData("domain-id");
		const fromCategoryId = event.dataTransfer.getData("from-category-id");

		if (domainId && handleMoveDomainToCategory) {
			// 同じカテゴリへのドロップでなければ処理
			if (fromCategoryId !== category.id) {
				handleMoveDomainToCategory(
					domainId,
					fromCategoryId || null,
					category.id,
				);
			}
		}
	};

	// ドラッグ終了時の処理
	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			// ドメインの並び順を更新
			const oldIndex = localDomains.findIndex(
				(domain) => domain.id === active.id,
			);
			const newIndex = localDomains.findIndex(
				(domain) => domain.id === over.id,
			);

			if (oldIndex !== -1 && newIndex !== -1) {
				const updatedDomains = arrayMove(localDomains, oldIndex, newIndex);
				// ローカル状態を更新
				setLocalDomains(updatedDomains);
				// 親コンポーネントに通知してストレージに保存
				if (handleUpdateDomainsOrder) {
					handleUpdateDomainsOrder(category.id, updatedDomains);
				}
			}
		}
	};

	// カード内のタブをサブカテゴリごとに整理
	const organizeUrlsByCategory = () => {
		type UrlType = { url: string; title: string; subCategory?: string };
		// サブカテゴリでタブをグループ化
		const categorizedUrls: Record<string, UrlType[]> = {
			__uncategorized: [], // 未分類カテゴリを最初に初期化
		};

		// 初期化 - サブカテゴリの初期化
		if (domains[0]?.subCategories) {
			for (const cat of domains[0].subCategories) {
				categorizedUrls[cat] = [];
			}
		}

		// URLを適切なカテゴリに振り分け
		for (const domain of domains) {
			for (const url of domain.urls) {
				if (
					url.subCategory &&
					domain.subCategories?.includes(url.subCategory)
				) {
					categorizedUrls[url.subCategory].push(url);
				} else {
					categorizedUrls.__uncategorized.push(url);
				}
			}
		}

		return categorizedUrls;
	};

	const categorizedUrls = organizeUrlsByCategory();
	const subCategories = [...(domains[0].subCategories || [])];

	// 未分類のタブがあれば、それも表示
	const hasUncategorized = categorizedUrls.__uncategorized.length > 0;

	return (
		<Card
			ref={setNodeRef}
			style={style}
			className={`${isDraggingOver ? "border-primary" : "border-border"}`}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<CardHeader className="flex-row justify-between items-center mb-2">
				<div
					className="flex items-center gap-3 flex-grow cursor-grab hover:cursor-grab active:cursor-grabbing"
					{...attributes}
					{...listeners}
				>
					<span className="text-foreground">
						<GripVertical size={16} aria-hidden="true" />
					</span>
					<h2 className="text-xl font-bold text-foreground">{category.name}</h2>
					<span className="text-muted-foreground">
						({domains.length}ドメイン / {allUrls.length}タブ)
					</span>
				</div>
				<div className="flex-shrink-0 ml-2 pointer-events-auto">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="secondary"
								size="sm"
								onClick={() => handleOpenAllTabs(allUrls)}
								className="flex items-center gap-1 cursor-pointer"
								title="すべてのタブを開く"
								aria-label="すべてのタブを開く"
							>
								<ExternalLink size={14} />
								<span className="lg:inline hidden">すべて開く</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent side="top" className="lg:hidden block">
							すべてのタブを開く
						</TooltipContent>
					</Tooltip>
				</div>
			</CardHeader>
			{!isCollapsed && (
				<CardContent>
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
					>
						<SortableContext
							items={localDomains.map((domain) => domain.id)}
							strategy={verticalListSortingStrategy}
						>
							{localDomains.map((group) => (
								<SortableDomainCard
									key={group.id}
									group={group}
									handleOpenAllTabs={handleOpenAllTabs}
									handleDeleteGroup={handleDeleteGroup}
									handleDeleteUrl={handleDeleteUrl}
									handleOpenTab={handleOpenTab}
									handleUpdateUrls={handleUpdateUrls}
									handleDeleteCategory={handleDeleteCategory}
									categoryId={category.id} // 親カテゴリIDを渡す
									isDraggingOver={false}
									settings={settings} // settingsを渡す
								/>
							))}
						</SortableContext>
					</DndContext>
				</CardContent>
			)}
		</Card>
	);
};

// SortableDomainCardコンポーネントを修正
const SortableDomainCard = ({
	group,
	handleOpenAllTabs,
	handleDeleteGroup,
	handleDeleteUrl,
	handleOpenTab,
	handleUpdateUrls,
	handleDeleteCategory,
	categoryId, // 親カテゴリIDを受け取る
	isDraggingOver,
	settings, // 追加: settingsを受け取る
}: SortableDomainCardProps & { settings: UserSettings }) => {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({ id: group.id });
	const [showKeywordModal, setShowKeywordModal] = useState(false);
	// カテゴリの順序を管理する状態を追加
	const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
	// 未分類も含めたすべてのカテゴリを管理する状態を追加
	const [allCategoryIds, setAllCategoryIds] = useState<string[]>([]);
	// カテゴリ更新フラグ - カテゴリ削除後のリフレッシュ用
	const [categoryUpdateTrigger, setCategoryUpdateTrigger] = useState(0);

	// カード内のタブをサブカテゴリごとに整理
	const organizeUrlsByCategory = () => {
		type UrlType = { url: string; title: string; subCategory?: string };
		// サブカテゴリでタブをグループ化
		const categorizedUrls: Record<string, UrlType[]> = {
			__uncategorized: [], // 未分類カテゴリを最初に初期化
		};

		// 初期化 - サブカテゴリの初期化
		if (group.subCategories) {
			for (const cat of group.subCategories) {
				categorizedUrls[cat] = [];
			}
		}

		// URLを適切なカテゴリに振り分け
		for (const url of group.urls) {
			if (url.subCategory && group.subCategories?.includes(url.subCategory)) {
				categorizedUrls[url.subCategory].push(url);
			} else {
				categorizedUrls.__uncategorized.push(url);
			}
		}

		return categorizedUrls;
	};

	const categorizedUrls = organizeUrlsByCategory();

	// 空でないカテゴリのみを表示に含める（修正版）
	const getActiveCategoryIds = useCallback(() => {
		console.log("getActiveCategoryIds 関数実行...");

		// URLごとのサブカテゴリを調べて、実際に使用されているカテゴリをリストアップ
		const usedCategories = new Set<string>();
		for (const url of group.urls) {
			if (url.subCategory) {
				usedCategories.add(url.subCategory);
			}
		}
		console.log("使用されているカテゴリ:", Array.from(usedCategories));

		// 通常のカテゴリで内容のあるもの
		const regularCategories = (group.subCategories || []).filter(
			(a, b) =>
				usedCategories.has(a) ||
				(categorizedUrls[a] && categorizedUrls[a].length > 0),
		);
		console.log("表示すべき通常カテゴリ:", regularCategories);

		// 未分類カテゴリに内容がある場合
		const hasUncategorized =
			categorizedUrls.__uncategorized &&
			categorizedUrls.__uncategorized.length > 0;

		// すでに保存された順序があれば利用
		if (
			group.subCategoryOrderWithUncategorized &&
			group.subCategoryOrderWithUncategorized.length > 0
		) {
			// まず現在の順序をフィルタリング
			const filteredOrder = group.subCategoryOrderWithUncategorized.filter(
				(id) => {
					if (id === "__uncategorized") return hasUncategorized;
					return regularCategories.includes(id);
				},
			);

			// 新しいカテゴリがあれば追加
			for (const cat of regularCategories) {
				if (!filteredOrder.includes(cat)) {
					filteredOrder.push(cat);
				}
			}

			// 未分類があれば末尾に追加
			if (hasUncategorized && !filteredOrder.includes("__uncategorized")) {
				filteredOrder.push("__uncategorized");
			}

			console.log("保存された順序から構築:", filteredOrder);
			return filteredOrder;
		}

		// 新規作成: カテゴリ順序を初期化
		const initialOrder = [...regularCategories];
		if (hasUncategorized) {
			initialOrder.push("__uncategorized");
		}

		console.log("新規作成されたカテゴリ順序:", initialOrder);
		return initialOrder;
	}, [
		group.subCategories,
		group.urls,
		categorizedUrls,
		group.subCategoryOrderWithUncategorized,
	]);

	// アクティブカテゴリの初期化
	useEffect(() => {
		const initializeCategories = () => {
			const activeIds = getActiveCategoryIds();
			console.log("初期カテゴリID設定:", activeIds);
			setAllCategoryIds(activeIds);
		};

		// 初期化が必要な場合のみ実行
		if (allCategoryIds.length === 0) {
			initializeCategories();
		}
	}, [allCategoryIds.length, getActiveCategoryIds]); // 依存関係を正しく指定

	// コンポーネントの外部に移動
	const arraysEqual = (a: string[], b: string[]) => {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	};

	// カテゴリ順序の初期化と更新
	useEffect(() => {
		if (group.subCategories) {
			// subCategoryOrder がある場合はそれを使用、なければ subCategories をそのまま使用
			const initialOrder = group.subCategoryOrder || [...group.subCategories];
			setCategoryOrder(initialOrder);
		}

		// subCategoryOrderWithUncategorizedがあればそれを使用
		if (group.subCategoryOrderWithUncategorized) {
			const savedOrder = [...group.subCategoryOrderWithUncategorized];
			if (savedOrder.length > 0) {
				console.log("保存済みの順序を読み込み:", savedOrder);
				setAllCategoryIds(savedOrder);
			}
		}
	}, [
		group.subCategories,
		group.subCategoryOrder,
		group.subCategoryOrderWithUncategorized,
	]);

	// アクティブカテゴリの更新とallCategoryIdsの初期化
	useEffect(() => {
		const updateCategoryOrder = (activeIds: string[]) => {
			if (
				!group.subCategoryOrderWithUncategorized &&
				activeIds.includes("__uncategorized")
			) {
				const regularOrder = activeIds.filter((id) => id !== "__uncategorized");
				handleUpdateCategoryOrder(regularOrder, activeIds);
			}
		};

		// すでに読み込んでいる場合はスキップ
		if (allCategoryIds.length > 0) {
			return;
		}

		const activeIds = getActiveCategoryIds();

		// allCategoryIdsが空の場合は初期化
		if (activeIds.length > 0) {
			console.log("初期カテゴリ順序の設定:", activeIds);
			setAllCategoryIds(activeIds);
			// 新たに生成した順序を永続化するため保存
			updateCategoryOrder(activeIds);
		}
	}, [group, getActiveCategoryIds, allCategoryIds.length]);

	// カテゴリ順序の更新を保存する関数
	const handleUpdateCategoryOrder = async (
		updatedOrder: string[],
		updatedAllOrder?: string[],
	) => {
		try {
			// ローカル状態を更新
			setCategoryOrder(updatedOrder);

			// 全カテゴリ順序も指定がある場合は更新
			if (updatedAllOrder) {
				setAllCategoryIds(updatedAllOrder);
			}

			// 保存処理
			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
			const updatedTabs = savedTabs.map((tab: TabGroup) => {
				if (tab.id === group.id) {
					const updatedTab = {
						...tab,
						subCategoryOrder: updatedOrder,
						// 未分類を含む順序も保存
						subCategoryOrderWithUncategorized:
							updatedAllOrder || allCategoryIds,
					};
					console.log(
						"保存するカテゴリ順序:",
						updatedTab.subCategoryOrderWithUncategorized,
					);
					return updatedTab;
				}
				return tab;
			});

			await chrome.storage.local.set({ savedTabs: updatedTabs });
			console.log("カテゴリ順序を更新しました:", updatedOrder);
			console.log("未分類含む順序も更新:", updatedAllOrder || allCategoryIds);
		} catch (error) {
			console.error("カテゴリ順序の更新に失敗しました:", error);
		}
	};

	// カテゴリのドラッグ&ドロップハンドラ
	const handleCategoryDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			// カテゴリの順序を更新
			const oldIndex = allCategoryIds.indexOf(active.id as string);
			const newIndex = allCategoryIds.indexOf(over.id as string);

			if (oldIndex !== -1 && newIndex !== -1) {
				// 新しい並び順を作成
				const updatedAllCategoryIds = arrayMove(
					allCategoryIds,
					oldIndex,
					newIndex,
				);

				console.log("新しいカテゴリ順序:", updatedAllCategoryIds);

				// 通常のカテゴリのみの順序を抽出（__uncategorizedを除く）
				const updatedCategoryOrder = updatedAllCategoryIds.filter(
					(id) => id !== "__uncategorized" && group.subCategories?.includes(id),
				);

				// 保存用の順序を更新（未分類を含む順序も保存）
				handleUpdateCategoryOrder(updatedCategoryOrder, updatedAllCategoryIds);
			}
		}
	};

	// DnDのセンサー設定
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	// allCategoryIds の依存関係と更新ロジックを修正
	// 初回ロード時または変更検出時の効果
	// biome-ignore lint/correctness/useExhaustiveDependencies: arraysEqual is a stable function
	useEffect(() => {
		const activeIds = getActiveCategoryIds();
		console.log("カテゴリ状態を再計算 - 有効カテゴリ:", activeIds);

		// アクティブなカテゴリが見つかり、現在の表示と異なる場合に更新
		if (activeIds.length > 0 && !arraysEqual(activeIds, allCategoryIds)) {
			console.log("カテゴリ表示を更新:", activeIds);
			setAllCategoryIds(activeIds);
		}
	}, [getActiveCategoryIds, allCategoryIds, categoryUpdateTrigger]);

	// カテゴリ設定やキーワードの変更を監視して表示を更新
	// biome-ignore lint/correctness/useExhaustiveDependencies: arraysEqual is a stable function
	useEffect(() => {
		// サブカテゴリまたはキーワード設定の変更を検知
		if (group.subCategories || group.categoryKeywords) {
			const activeIds = getActiveCategoryIds();
			if (activeIds.length > 0 && !arraysEqual(activeIds, allCategoryIds)) {
				console.log("カテゴリ設定変更を検知 - 表示を更新:", activeIds);
				setAllCategoryIds(activeIds);
			}
		}
	}, [
		group.subCategories,
		group.categoryKeywords,
		getActiveCategoryIds,
		allCategoryIds,
	]);

	// タブの変更を検知して強制的に表示を更新する追加のロジック
	const prevUrlsRef = useRef<TabGroup["urls"]>([]);
	useEffect(() => {
		// タブのサブカテゴリに変更があった場合のみ再計算
		const prevUrls = prevUrlsRef.current;
		const currentUrls = group.urls;

		// サブカテゴリの変更を検出
		const hasSubCategoryChanges =
			prevUrls.length > 0 &&
			(prevUrls.length !== currentUrls.length ||
				prevUrls.some(
					(prevUrl, i) =>
						i >= currentUrls.length ||
						prevUrl.subCategory !== currentUrls[i].subCategory,
				));

		if (hasSubCategoryChanges) {
			console.log("タブのサブカテゴリ変更を検出 - 表示を更新");
			const activeIds = getActiveCategoryIds();
			setAllCategoryIds(activeIds);
		}

		// 参照を更新
		prevUrlsRef.current = [...currentUrls];
	}, [group.urls, getActiveCategoryIds]);

	// モーダルを閉じる際に強制更新する処理を追加
	const handleCloseKeywordModal = () => {
		setShowKeywordModal(false);
		// 強制的にカテゴリデータを再計算するためのトリガー
		setCategoryUpdateTrigger((prev) => prev + 1);

		// 0.5秒後に再度更新して、データの反映を確認
		setTimeout(() => {
			setCategoryUpdateTrigger((prev) => prev + 1);
		}, 500);
	};

	// カテゴリ削除後の処理を追加
	const handleCategoryDelete = async (
		groupId: string,
		categoryName: string,
	) => {
		if (handleDeleteCategory) {
			await handleDeleteCategory(groupId, categoryName);
			// 削除後に強制更新
			setCategoryUpdateTrigger((prev) => prev + 1);
		}
	};

	return (
		<Card
			ref={setNodeRef}
			style={style}
			className={`rounded-lg shadow-md ${isDraggingOver ? "border-blue-500 border-2" : "border-border"
				}`}
			data-category-id={categoryId} // データ属性として親カテゴリIDを設定
		>
			<CardHeader className="p-2 pb-0 w-full">
				<div className="flex items-center justify-between w-full">
					{/* 左側: ドメイン情報 */}
					<div
						className={
							"flex items-center gap-3 cursor-grab overflow-hidden flex-grow hover:cursor-grab active:cursor-grabbing"
						}
						{...attributes}
						{...listeners}
					>
						<div className="text-muted-foreground/80 flex-shrink-0">
							<GripVertical size={16} aria-hidden="true" />
						</div>
						<h2 className="text-lg font-semibold text-foreground truncate">
							{group.domain}
							<span className="text-sm text-muted-foreground">
								{" "}
								({group.urls.length})
							</span>
						</h2>
					</div>

					{/* 右側: 操作ボタン類 */}
					<div className="flex items-center gap-2 flex-shrink-0 ml-2">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="secondary"
									size="sm"
									onClick={() => setShowKeywordModal(true)}
									className="text-secondary-foreground flex items-center gap-1 cursor-pointer"
									title="カテゴリ管理"
								>
									<Settings size={14} />
									<span className="lg:inline hidden">カテゴリ管理</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent side="top" className="lg:hidden block">
								カテゴリ管理
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="secondary"
									size="sm"
									onClick={() => handleOpenAllTabs(group.urls)}
									className="flex items-center gap-1 cursor-pointer"
									title="すべてのタブを開く"
									aria-label="すべてのタブを開く"
								>
									<ExternalLink size={14} />
									<span className="lg:inline hidden">すべて開く</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent side="top" className="lg:hidden block">
								すべてのタブを開く
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="secondary"
									size="sm"
									onClick={() => handleDeleteGroup(group.id)}
									className="flex items-center gap-1 cursor-pointer"
									title="グループを削除"
									aria-label="グループを削除"
								>
									<Trash size={14} />
									<span className="lg:inline hidden">削除</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent side="top" className="lg:hidden block">
								グループを削除
							</TooltipContent>
						</Tooltip>
					</div>
				</div>

				{/* モーダルは最上位に配置 */}
				{showKeywordModal && (
					<CategoryKeywordModal
						group={group}
						isOpen={showKeywordModal}
						onClose={handleCloseKeywordModal}
						onSave={handleSaveKeywords}
						onDeleteCategory={handleCategoryDelete}
					/>
				)}
			</CardHeader>

			{/* カテゴリごとにまとめてタブを表示 */}
			<CardContent className="space-y-1 p-2">
				{allCategoryIds.length > 0 && (
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleCategoryDragEnd}
					>
						<SortableContext
							items={allCategoryIds}
							strategy={verticalListSortingStrategy}
						>
							{/* カテゴリ順序に従ってカテゴリセクションを表示（未分類を含む） */}
							{allCategoryIds.map((categoryName) => (
								<SortableCategorySection
									key={categoryName}
									id={categoryName}
									categoryName={categoryName}
									urls={categorizedUrls[categoryName] || []}
									groupId={group.id}
									handleDeleteUrl={handleDeleteUrl}
									handleOpenTab={handleOpenTab}
									handleUpdateUrls={handleUpdateUrls}
									handleOpenAllTabs={handleOpenAllTabs} // カテゴリごとのすべて開く機能を渡す
									settings={settings} // 設定を渡す
								/>
							))}
						</SortableContext>
					</DndContext>
				)}
				{allCategoryIds.length === 0 && group.urls.length > 0 && (
					<div className="text-center py-4 text-gray-400">
						カテゴリを追加するにはカテゴリ管理から行ってください
					</div>
				)}
			</CardContent>
		</Card>
	);
};

// 並び替え可能なカテゴリセクションコンポーネント
const SortableCategorySection = ({
	id,
	handleOpenAllTabs,
	settings,
	...props
}: SortableCategorySectionProps & { settings: UserSettings }) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id,
		data: {
			type: "category-section",
		},
	});

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		zIndex: isDragging ? 100 : "auto",
		position: isDragging ? "relative" : "static",
		opacity: isDragging ? 0.8 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={
				isDragging
					? "category-section mb-1 bg-muted rounded-md shadow-lg"
					: "category-section mb-1"
			}
		>
			<div className="category-header mb-0.5 pb-0.5 border-b border-border flex items-center justify-between">
				{/* ドラッグハンドル部分 */}
				<div
					className={`flex items-center flex-grow ${isDragging ? "cursor-grabbing" : "cursor-grab hover:cursor-grab active:cursor-grabbing"}`}
					{...attributes}
					{...listeners}
				>
					<div className="mr-2 text-muted-foreground/60">
						<GripVertical size={16} aria-hidden="true" />
					</div>
					<h3 className="font-medium text-foreground">
						{props.categoryName === "__uncategorized"
							? "未分類"
							: props.categoryName}{" "}
						<span className="text-sm text-muted-foreground">
							({props.urls.length})
						</span>
					</h3>
				</div>

				{/* すべて開くボタン - 独立した要素としてドラッグハンドラの影響を受けないようにする */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="secondary"
							size="sm"
							onClick={(e) => {
								e.stopPropagation(); // ドラッグイベントの伝播を防止
								handleOpenAllTabs(props.urls);
							}}
							className="flex items-center gap-1 z-20 pointer-events-auto cursor-pointer"
							title={`${props.categoryName === "__uncategorized" ? "未分類" : props.categoryName}のタブをすべて開く`}
							style={{ position: "relative" }} // ボタンを確実に上に表示
						>
							<ExternalLink size={14} />
							<span className="lg:inline hidden">すべて開く</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top" className="lg:hidden block">
						すべてのタブを開く
					</TooltipContent>
				</Tooltip>
			</div>

			<CategorySection {...props} settings={settings} />
		</div>
	);
};

// 新しく追加: カテゴリセクションコンポーネント
const CategorySection = ({
	categoryName,
	urls,
	groupId,
	handleDeleteUrl,
	handleOpenTab,
	handleUpdateUrls,
	handleOpenAllTabs, // 追加: すべて開く処理
	settings, // 追加: 設定を受け取る
}: CategorySectionProps) => {
	// DnDのセンサー設定
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	// カテゴリ内でのドラッグ&ドロップハンドラ
	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			// このカテゴリ内のURLsを取得
			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
			const currentGroup = savedTabs.find(
				(group: TabGroup) => group.id === groupId,
			);

			if (!currentGroup) return;

			// 現在のグループのすべてのURLを取得
			const allUrls = [...currentGroup.urls];

			// ドラッグ元とドラッグ先のインデックスを特定
			const oldIndex = allUrls.findIndex((item) => item.url === active.id);
			const newIndex = allUrls.findIndex((item) => item.url === over.id);

			if (oldIndex !== -1 && newIndex !== -1) {
				// 並び替えた新しい配列を作成
				const newUrls = arrayMove(allUrls, oldIndex, newIndex);

				// 親コンポーネント経由でストレージに保存
				handleUpdateUrls(groupId, newUrls);
			}
		}
	};

	// 表示名を設定
	const displayName =
		categoryName === "__uncategorized" ? "未分類" : categoryName;

	return (
		<div className="category-section mb-1">
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
				id={`category-${categoryName}-${groupId}`}
			>
				<SortableContext
					items={urls.map((item) => item.url)}
					strategy={verticalListSortingStrategy}
				>
					<ul className="space-y-0.5">
						{urls.map((item) => (
							<SortableUrlItem
								key={item.url}
								url={item.url}
								title={item.title}
								id={item.url}
								groupId={groupId}
								subCategory={item.subCategory}
								savedAt={item.savedAt}
								autoDeletePeriod={settings.autoDeletePeriod}
								handleDeleteUrl={handleDeleteUrl}
								handleOpenTab={handleOpenTab}
								handleUpdateUrls={handleUpdateUrls}
								categoryContext={`category-${categoryName}-${groupId}`}
								settings={settings}
							/>
						))}
					</ul>
				</SortableContext>
			</DndContext>
		</div>
	);
};

// URL項目用のソータブルコンポーネント - 型定義を修正
const SortableUrlItem = ({
	url,
	title,
	id,
	groupId,
	subCategory,
	savedAt, // 個別プロパティとして受け取る
	autoDeletePeriod, // 個別プロパティとして受け取る
	availableSubCategories = [],
	handleDeleteUrl,
	handleOpenTab,
	handleSetSubCategory,
	categoryContext,
	settings,
}: SortableUrlItemProps) => {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({
			id,
			data: {
				categoryContext, // カテゴリコンテキストをデータに追加
			},
		});

	const [isDragging, setIsDragging] = useState(false);
	const [leftWindow, setLeftWindow] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const dragTimeoutRef = useRef<number | null>(null);
	const [isDeleteButtonVisible, setIsDeleteButtonVisible] = useState(false);
	const buttonTimeoutRef = useRef<number | null>(null);

	// ドラッグが開始されたとき
	const handleDragStart = (
		e: React.DragEvent<HTMLButtonElement>,
		url: string,
	) => {
		setIsDragging(true);
		setLeftWindow(false);
		// URLをテキストとして設定
		e.dataTransfer.setData("text/plain", url);
		// URI-listとしても設定（多くのブラウザやアプリがこのフォーマットを認識）
		e.dataTransfer.setData("text/uri-list", url);

		console.log("ドラッグ開始:", url);

		// ドキュメント全体のmouseleaveイベントを監視
		document.addEventListener("mouseleave", handleMouseLeave);

		// ドラッグ開始をバックグラウンドに通知
		chrome.runtime.sendMessage(
			{
				action: "urlDragStarted",
				url: url,
				groupId: groupId,
			},
			(response) => {
				console.log("ドラッグ開始通知の応答:", response);
			},
		);
	};

	// 外部ウィンドウへのドロップ処理
	const handleExternalDrop = useCallback(() => {
		// 外部へのドロップ時にタブを削除するよう通知
		chrome.runtime.sendMessage(
			{
				action: "urlDropped",
				url: url,
				groupId: groupId,
				fromExternal: true,
			},
			(response) => {
				console.log("外部ドロップ後の応答:", response);
			},
		);
	}, [url, groupId]);

	const handleDragEnd = (e: React.DragEvent<HTMLButtonElement>) => {
		// リスナーをクリーンアップ
		document.removeEventListener("mouseleave", handleMouseLeave);

		// タイムアウトをクリア
		if (dragTimeoutRef.current) {
			clearTimeout(dragTimeoutRef.current);
			dragTimeoutRef.current = null;
		}

		setIsDragging(false);
		console.log("ドラッグ終了:", e.dataTransfer.dropEffect);

		// 内部で完了した場合は、leftWindowフラグをリセット
		setLeftWindow(false);
	};

	// マウスリーブハンドラをメモ化
	const handleMouseLeave = useCallback(() => {
		// マウスがウィンドウを出たことを記録
		setLeftWindow(true);
		console.log("マウスがウィンドウから出ました");

		// windowに戻ってこなければ、タイムアウト後に外部ウィンドウへのドロップと判定
		if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
		dragTimeoutRef.current = window.setTimeout(() => {
			if (isDragging && leftWindow) {
				console.log("外部ウィンドウへのドラッグを検出:", url);
				handleExternalDrop();
			}
		}, 1000) as unknown as number;
	}, [isDragging, leftWindow, url, handleExternalDrop]);

	// コンポーネントのアンマウント時にクリーンアップ
	useEffect(() => {
		return () => {
			document.removeEventListener("mouseleave", handleMouseLeave);
			if (dragTimeoutRef.current) {
				clearTimeout(dragTimeoutRef.current);
			}
		};
	}, [handleMouseLeave]);

	// マウスイベントの処理を改善
	const handleMouseEnter = () => {
		setIsHovered(true);
		setIsDeleteButtonVisible(true);
		// タイマーをクリア
		if (buttonTimeoutRef.current) {
			clearTimeout(buttonTimeoutRef.current);
			buttonTimeoutRef.current = null;
		}
	};

	const handleUIMouseLeave = () => {
		setIsHovered(false);
		// ボタンの非表示を少し遅らせて、ボタンへのマウス移動を可能にする
		buttonTimeoutRef.current = window.setTimeout(() => {
			setIsDeleteButtonVisible(false);
		}, 300) as unknown as number;
	};

	// コンポーネントのアンマウント時にクリーンアップ
	useEffect(() => {
		return () => {
			if (buttonTimeoutRef.current) {
				clearTimeout(buttonTimeoutRef.current);
			}
		};
	}, []);

	// 削除ボタンのマウスイベント処理
	const handleDeleteButtonMouseEnter = () => {
		// タイマーをクリアして非表示にならないようにする
		if (buttonTimeoutRef.current) {
			clearTimeout(buttonTimeoutRef.current);
			buttonTimeoutRef.current = null;
		}
		setIsDeleteButtonVisible(true);
	};

	const handleDeleteButtonClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		handleDeleteUrl(groupId, url);
	};

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<li
			ref={setNodeRef}
			style={style}
			className="border-b border-border pb-1 last:border-0 last:pb-0 flex items-center relative overflow-hidden"
			data-category-context={categoryContext} // カテゴリコンテキストをdata属性に追加
		>
			<div
				className="text-muted-foreground/40 cursor-grab hover:cursor-grab active:cursor-grabbing mr-2 z-10 flex-shrink-0"
				{...attributes}
				{...listeners}
			>
				<GripVertical size={16} aria-hidden="true" />
			</div>
			<div className="flex-1 relative min-w-0">
				<Button
					variant="ghost"
					size="sm"
					draggable="true"
					onDragStart={(e) => handleDragStart(e, url as string)}
					onDragEnd={handleDragEnd}
					onClick={() => handleOpenTab(url)}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleUIMouseLeave}
					className="text-foreground hover:text-foreground hover:underline cursor-pointer text-left w-full bg-transparent border-0 flex items-center gap-1 h-full justify-start px-0 pr-8 overflow-hidden"
					title={title}
				>
					<div className="flex flex-col truncate w-full">
						<span className="truncate">{title}</span>
						{/* 保存日時と残り時間を表示 - settings.showSavedTime に基づき条件分岐 */}
						{savedAt && (
							<div className="flex gap-2 items-center text-xs">
								{settings.showSavedTime && (
									<span className="text-muted-foreground">
										{formatDatetime(savedAt)}
									</span>
								)}
								{autoDeletePeriod && autoDeletePeriod !== "never" && (
									<TimeRemaining
										savedAt={savedAt}
										autoDeletePeriod={autoDeletePeriod}
									/>
								)}
							</div>
						)}
					</div>
				</Button>
				{isDeleteButtonVisible && (
					<Button
						variant="outline"
						size="icon"
						onClick={handleDeleteButtonClick}
						onMouseEnter={handleDeleteButtonMouseEnter}
						className="absolute right-0 top-0 bottom-0 my-auto flex-shrink-0 cursor-pointer"
						title="URLを削除"
						aria-label="URLを削除"
					>
						<X size={14} />
					</Button>
				)}
			</div>
		</li>
	);
};

// カテゴリキーワード管理モーダルコンポーネント
const CategoryKeywordModal = ({
	group,
	isOpen,
	onClose,
	onSave,
	onDeleteCategory,
}: CategoryKeywordModalProps) => {
	const [activeCategory, setActiveCategory] = useState<string>(
		group.subCategories && group.subCategories.length > 0
			? group.subCategories[0]
			: "",
	);
	const [keywords, setKeywords] = useState<string[]>([]);
	const [newKeyword, setNewKeyword] = useState("");
	const [newSubCategory, setNewSubCategory] = useState("");
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const modalContentRef = useRef<HTMLDivElement>(null);
	const [isRenaming, setIsRenaming] = useState(false);
	const [newCategoryName, setNewCategoryName] = useState("");

	useEffect(() => {
		if (isOpen && activeCategory) {
			const categoryKeywords = group.categoryKeywords?.find(
				(ck) => ck.categoryName === activeCategory,
			);
			setKeywords(categoryKeywords?.keywords || []);
			setIsRenaming(false);
			setNewCategoryName("");
		}
	}, [isOpen, activeCategory, group]);

	if (!isOpen) return null;

	// 重複した状態定義を削除

	useEffect(() => {
		if (isOpen && activeCategory) {
			console.log("現在のカテゴリ:", activeCategory);
			// 選択されたカテゴリのキーワードを読み込む
			const categoryKeywords = group.categoryKeywords?.find(
				(ck) => ck.categoryName === activeCategory,
			);
			const loadedKeywords = categoryKeywords?.keywords || [];
			console.log("読み込まれたキーワード:", loadedKeywords);
			setKeywords(loadedKeywords);
			// リネームモードの初期化とカテゴリ名のリセット
			setIsRenaming(false);
			setNewCategoryName("");
		}
	}, [isOpen, activeCategory, group]);

	// キーワードを追加した時に重複チェックを追加
	const handleAddKeyword = () => {
		if (!newKeyword.trim()) return;

		const trimmedKeyword = newKeyword.trim();
		console.log("追加するキーワード:", trimmedKeyword);
		console.log("既存のキーワード:", keywords);

		// 完全一致する場合のみ重複とみなす（大文字小文字は区別しない）
		const isDuplicate = keywords.some(
			(keyword) => keyword.toLowerCase() === trimmedKeyword.toLowerCase(),
		);

		if (isDuplicate) {
			toast.error("このキーワードは既に追加されています");
			return;
		}

		const updatedKeywords = [...keywords, trimmedKeyword];
		console.log("更新後のキーワード:", updatedKeywords);

		// 状態を更新
		setKeywords(updatedKeywords);
		setNewKeyword("");

		// 即座に保存
		onSave(group.id, activeCategory, updatedKeywords);
	};

	// キーワードを削除した時に自動保存するよう変更
	const handleRemoveKeyword = (keywordToRemove: string) => {
		console.log("削除するキーワード:", keywordToRemove);
		const updatedKeywords = keywords.filter((k) => k !== keywordToRemove);
		console.log("削除後のキーワード:", updatedKeywords);

		setKeywords(updatedKeywords);

		// 即座に保存
		onSave(group.id, activeCategory, updatedKeywords);
	};

	// モーダルコンテンツのクリックイベントの伝播を停止
	const handleContentClick = (e: React.MouseEvent | React.KeyboardEvent) => {
		e.stopPropagation();
	};

	// 子カテゴリ追加機能 - 修正版: 重複チェックと処理中フラグを追加
	const handleAddSubCategory = async () => {
		// 空の場合や処理中の場合は何もしない
		if (!newSubCategory.trim() || isProcessing) return;

		// 既存のカテゴリと重複していないか確認
		if (group.subCategories?.includes(newSubCategory.trim())) {
			alert("このカテゴリ名は既に存在しています");
			return;
		}

		// 処理中フラグをセット
		setIsProcessing(true);

		try {
			// 直接chrome.storage.localから保存されたタブを取得
			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

			// 重複しないように更新するため、既存のものを探して更新
			const updatedTabs = savedTabs.map((tab: TabGroup) => {
				// IDが一致するタブグループのみ更新
				if (tab.id === group.id) {
					return {
						...tab,
						subCategories: [
							...(tab.subCategories || []),
							newSubCategory.trim(),
						],
					};
				}
				return tab;
			});

			// 更新したタブグループをストレージに保存
			await chrome.storage.local.set({ savedTabs: updatedTabs });

			// カテゴリを追加したら、それをアクティブにする
			setActiveCategory(newSubCategory.trim());
			setNewSubCategory("");
		} catch (error) {
			console.error("子カテゴリ追加エラー:", error);
		} finally {
			// 処理完了後にフラグをリセット
			setIsProcessing(false);
		}
	};

	// カテゴリを削除する関数 - 修正版
	const handleDeleteCategory = async () => {
		if (!activeCategory) return;

		console.log("カテゴリ削除開始:", activeCategory);

		// 関数の存在確認を追加
		if (typeof onDeleteCategory !== "function") {
			console.error("削除関数が定義されていません");
			return;
		}

		try {
			const categoryToDelete = activeCategory; // 現在のカテゴリを保存
			console.log("削除処理実行:", group.id, categoryToDelete);

			// 削除処理を実行
			await onDeleteCategory(group.id, categoryToDelete);
			console.log("カテゴリ削除成功:", categoryToDelete);

			// 削除後は別のカテゴリを選択
			if (group.subCategories && group.subCategories.length > 1) {
				// 削除したカテゴリ以外のカテゴリを選択
				const updatedSubCategories = group.subCategories.filter(
					(cat) => cat !== categoryToDelete,
				);
				if (updatedSubCategories.length > 0) {
					setActiveCategory(updatedSubCategories[0]);
				} else {
					setActiveCategory("");
				}
			} else {
				// カテゴリがなくなった場合
				setActiveCategory("");
			}

			// 削除確認モーダルを閉じる
			setShowDeleteConfirm(false);
		} catch (error) {
			console.error("カテゴリ削除エラー:", error);
		}
	};

	// カテゴリ選択時に削除確認モーダルをリセット
	useEffect(() => {
		setShowDeleteConfirm(false);
	}, []); // 初期化時のみ実行

	// カテゴリのリネーム処理を開始
	const handleStartRenaming = () => {
		setNewCategoryName(activeCategory);
		setIsRenaming(true);
		// 入力フィールドにフォーカスが当たったら全選択状態にする
		setTimeout(() => {
			const inputElement = document.querySelector(
				"input[data-rename-input]",
			) as HTMLInputElement;
			if (inputElement) {
				inputElement.focus();
				inputElement.select(); // テキスト全体を選択状態に
			}
		}, 50);
	};

	// リネームをキャンセル
	const handleCancelRenaming = () => {
		setIsRenaming(false);
		setNewCategoryName("");
	};

	// カテゴリ名の変更を保存
	const handleSaveRenaming = async () => {
		// 変更がない場合や空の場合はリネームモードを終了
		if (!newCategoryName.trim() || newCategoryName.trim() === activeCategory) {
			setIsRenaming(false);
			setNewCategoryName("");
			return;
		}

		// すでに処理中の場合は何もしない
		if (isProcessing) return;

		// 既存のカテゴリと重複していないか確認
		if (group.subCategories?.includes(newCategoryName.trim())) {
			alert("このカテゴリ名は既に存在しています");
			// 入力フィールドにフォーカスを戻す
			setTimeout(() => {
				const inputElement = document.querySelector(
					"input[data-rename-input]",
				) as HTMLInputElement;
				if (inputElement) inputElement.focus();
			}, 50);
			return;
		}

		setIsProcessing(true);

		try {
			// 直接chrome.storage.localから保存されたタブを取得
			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

			// 対象のグループを見つけて更新
			const updatedTabs = savedTabs.map((tab: TabGroup) => {
				if (tab.id === group.id) {
					// サブカテゴリの更新
					const updatedSubCategories =
						tab.subCategories?.map((cat) =>
							cat === activeCategory ? newCategoryName.trim() : cat,
						) || [];

					// カテゴリキーワードの更新
					const updatedCategoryKeywords =
						tab.categoryKeywords?.map((ck) => {
							if (ck.categoryName === activeCategory) {
								return { ...ck, categoryName: newCategoryName.trim() };
							}
							return ck;
						}) || [];

					// URLのサブカテゴリも更新
					const updatedUrls = tab.urls.map((url) => {
						if (url.subCategory === activeCategory) {
							return { ...url, subCategory: newCategoryName.trim() };
						}
						return url;
					});

					// サブカテゴリの順序も更新
					let updatedSubCategoryOrder = tab.subCategoryOrder || [];
					if (updatedSubCategoryOrder.includes(activeCategory)) {
						updatedSubCategoryOrder = updatedSubCategoryOrder.map((cat) =>
							cat === activeCategory ? newCategoryName.trim() : cat,
						);
					}

					// 未分類を含む順序も更新
					let updatedAllOrder = tab.subCategoryOrderWithUncategorized || [];
					if (updatedAllOrder.includes(activeCategory)) {
						updatedAllOrder = updatedAllOrder.map((cat) =>
							cat === activeCategory ? newCategoryName.trim() : cat,
						);
					}

					return {
						...tab,
						subCategories: updatedSubCategories,
						categoryKeywords: updatedCategoryKeywords,
						urls: updatedUrls,
						subCategoryOrder: updatedSubCategoryOrder,
						subCategoryOrderWithUncategorized: updatedAllOrder,
					};
				}
				return tab;
			});

			// ストレージに保存
			await chrome.storage.local.set({ savedTabs: updatedTabs });

			// アクティブカテゴリを新しい名前に更新
			setActiveCategory(newCategoryName.trim());

			// リネームモードを終了
			setIsRenaming(false);
			setNewCategoryName("");

			console.log(
				`カテゴリ名を「${activeCategory}」から「${newCategoryName}」に変更しました`,
			);
		} catch (error) {
			console.error("カテゴリ名の変更中にエラーが発生しました:", error);
		} finally {
			setIsProcessing(false);
		}
	};

	if (!isOpen) return null;

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>「{group.domain}」のカテゴリ管理</DialogTitle>
					<DialogDescription>
						カテゴリの追加、削除、リネーム、キーワード設定を行います。
					</DialogDescription>
				</DialogHeader>

				<div
					ref={modalContentRef}
					onClick={handleContentClick}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							handleContentClick(e);
						}
					}}
					role="presentation"
					className="space-y-4"
				>
					{/* 子カテゴリ追加セクション */}
					<div className="mb-4 border-b border-zinc-700 pb-4">
						<h4 className="text-md font-medium mb-2 text-gray-300">
							新しい子カテゴリを追加
						</h4>
						<div className="flex">
							<Input
								value={newSubCategory}
								onChange={(e) => setNewSubCategory(e.target.value)}
								placeholder="新しいカテゴリ名を入力"
								className="flex-grow p-2 border rounded"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleAddSubCategory();
									}
								}}
								onBlur={() => {
									if (newSubCategory.trim()) {
										handleAddSubCategory();
									}
								}}
							/>
						</div>
					</div>

					{/* 既存のカテゴリ管理セクション */}
					{group.subCategories && group.subCategories.length > 0 ? (
						<>
							<div className="mb-4">
								<div className="flex justify-between items-center mb-2">
									<Label htmlFor="category-select">
										キーワード設定を行うカテゴリを選択
									</Label>

									<div className="flex gap-2">
										{!isRenaming && (
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														variant="secondary"
														size="sm"
														onClick={handleStartRenaming}
														className="px-2 py-1 rounded flex items-center gap-1 cursor-pointer"
														title="カテゴリ名を変更"
														disabled={!activeCategory}
													>
														<Settings size={14} />
														<span className="lg:inline hidden">名前を変更</span>
													</Button>
												</TooltipTrigger>
												<TooltipContent side="top" className="lg:hidden block">
													カテゴリ名を変更
												</TooltipContent>
											</Tooltip>
										)}

										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="secondary"
													size="sm"
													onClick={() => setShowDeleteConfirm(true)}
													className="px-2 py-1 rounded flex items-center gap-1 cursor-pointer"
													title="現在のカテゴリを削除"
													disabled={!activeCategory}
												>
													<Trash size={14} />
													<span className="lg:inline hidden">
														現在のカテゴリを削除
													</span>
												</Button>
											</TooltipTrigger>
											<TooltipContent side="top" className="lg:hidden block">
												現在のカテゴリを削除
											</TooltipContent>
										</Tooltip>
									</div>
								</div>

								{/* リネームフォーム */}
								{isRenaming && (
									<div className="mt-2 p-3 border rounded mb-3">
										<div className="text-gray-300 mb-2 text-sm">
											「{activeCategory}」の新しい名前を入力してください
											<br />
											<span className="text-xs text-gray-400">
												(入力後、フォーカスを外すかEnterキーで保存されます。キャンセルするにはEscを押してください)
											</span>
										</div>
										<Input
											value={newCategoryName}
											onChange={(e) => setNewCategoryName(e.target.value)}
											placeholder="新しいカテゴリ名"
											className="w-full p-2 border rounded"
											autoFocus
											data-rename-input="true"
											onBlur={handleSaveRenaming}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													e.currentTarget.blur();
												} else if (e.key === "Escape") {
													e.preventDefault();
													handleCancelRenaming();
												}
											}}
										/>
									</div>
								)}

								{/* 削除確認UI */}
								{showDeleteConfirm && (
									<div className="mt-2 p-3 border rounded mb-3">
										<p className="text-gray-300 mb-2">
											「{activeCategory}」カテゴリを削除しますか？
											<br />
											<span className="text-xs">
												このカテゴリに属するすべてのタブは未分類になります
											</span>
										</p>
										<div className="flex justify-end gap-2">
											<Button
												variant="secondary"
												size="sm"
												onClick={() => setShowDeleteConfirm(false)}
												className="text-primary-foreground px-2 py-1 rounded cursor-pointer"
											>
												キャンセル
											</Button>
											<Button
												variant="destructive"
												size="sm"
												onClick={handleDeleteCategory}
												className="flex items-center gap-1 cursor-pointer"
											>
												<Trash size={14} />
												<span className="lg:inline hidden">削除する</span>
											</Button>
										</div>
									</div>
								)}

								<Select
									value={activeCategory}
									onValueChange={setActiveCategory}
									disabled={isRenaming}
								>
									<SelectTrigger className="w-full p-2 border rounded cursor-pointer">
										<SelectValue placeholder="カテゴリを選択" />
									</SelectTrigger>
									<SelectContent>
										{group.subCategories.map((cat) => (
											<SelectItem
												key={cat}
												value={cat}
												className="cursor-pointer"
											>
												{cat}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* キーワード設定セクション */}
							<div className="mb-4">
								<Label
									htmlFor="keyword-input"
									className="block text-sm text-gray-400 mb-2"
								>
									「{activeCategory}」カテゴリのキーワード
									<span className="text-xs text-gray-500 ml-2">
										（タイトルにこれらの単語が含まれていると自動的にこのカテゴリに分類されます）
									</span>
								</Label>

								<div className="mb-2 flex">
									<Input
										id="keyword-input"
										value={newKeyword}
										onChange={(e) => setNewKeyword(e.target.value)}
										placeholder="新しいキーワードを入力"
										className="flex-grow p-2 border rounded"
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												handleAddKeyword();
											}
										}}
										onBlur={() => {
											if (newKeyword.trim()) {
												handleAddKeyword();
											}
										}}
										disabled={isRenaming}
									/>
								</div>

								<div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border rounded">
									{keywords.length === 0 ? (
										<p className="text-gray-500">キーワードがありません</p>
									) : (
										keywords.map((keyword) => (
											<Badge
												key={keyword}
												variant="outline"
												className="px-2 py-1 rounded flex items-center gap-1"
											>
												{keyword}
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleRemoveKeyword(keyword)}
													className="ml-1 text-gray-400 hover:text-gray-200 cursor-pointer"
													aria-label="キーワードを削除"
													disabled={isRenaming}
												>
													<X size={14} />
												</Button>
											</Badge>
										))
									)}
								</div>
							</div>
						</>
					) : (
						<p className="text-gray-400 mb-4">
							このドメインには子カテゴリがありません。上記のフォームから子カテゴリを追加してください。
						</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};

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
			<SavedTabs />
		</ThemeProvider>,
	);
});
