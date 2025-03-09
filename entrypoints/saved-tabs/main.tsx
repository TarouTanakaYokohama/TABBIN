import "@/assets/tailwind.css";
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
	autoCategorizeTabs,
	updateDomainCategorySettings,
	saveParentCategories,
	migrateParentCategoriesToDomainNames,
} from "../../utils/storage";
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

// カテゴリグループコンポーネント
interface CategoryGroupProps {
	category: ParentCategory;
	domains: TabGroup[];
	handleOpenAllTabs: (urls: { url: string; title: string }[]) => void;
	handleDeleteGroup: (id: string) => void;
	handleDeleteUrl: (groupId: string, url: string) => void;
	handleOpenTab: (url: string) => void;
	handleUpdateUrls: (groupId: string, updatedUrls: TabGroup["urls"]) => void;
	handleUpdateDomainsOrder?: (
		categoryId: string,
		updatedDomains: TabGroup[],
	) => void;
	handleMoveDomainToCategory?: (
		domainId: string,
		fromCategoryId: string | null,
		toCategoryId: string,
	) => void;
}

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

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`mb-6 bg-gray-50 p-4 rounded-lg border ${
				isDraggingOver ? "border-blue-500 border-2" : "border-gray-200"
			}`}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<div className="flex justify-between items-center mb-3">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setIsCollapsed(!isCollapsed)}
						className="text-gray-700"
					>
						{isCollapsed ? "▶" : "▼"}
					</button>

					<div
						className="flex items-center cursor-move"
						{...attributes}
						{...listeners}
					>
						<span className="text-gray-400 ml-1">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								fill="currentColor"
								viewBox="0 0 16 16"
							>
								<title>ドラッグして並び替え</title>
								<path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
							</svg>
						</span>
						<h2 className="text-xl font-bold text-gray-800">{category.name}</h2>
						<span className="text-gray-500">
							({domains.length}ドメイン / {allUrls.length}タブ)
						</span>
					</div>
				</div>
				<div>
					<button
						type="button"
						onClick={() => handleOpenAllTabs(allUrls)}
						className="text-sm bg-blue-500 text-white px-3 py-1 rounded mr-2 hover:bg-blue-600"
					>
						すべて開く
					</button>
				</div>
			</div>
			{!isCollapsed && (
				<div className="space-y-4">
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
									categoryId={category.id} // 親カテゴリIDを渡す
									isDraggingOver={false}
								/>
							))}
						</SortableContext>
					</DndContext>
				</div>
			)}
		</div>
	);
};

// ドメインカード用のソータブルコンポーネント
interface SortableDomainCardProps {
	group: TabGroup;
	handleOpenAllTabs: (urls: { url: string; title: string }[]) => void;
	handleDeleteGroup: (id: string) => void;
	handleDeleteUrl: (groupId: string, url: string) => void;
	handleOpenTab: (url: string) => void;
	handleUpdateUrls: (groupId: string, updatedUrls: TabGroup["urls"]) => void;
	categoryId?: string; // 親カテゴリIDを追加
	isDraggingOver?: boolean; // ドラッグオーバー状態を追加
}

const SortableDomainCard = ({
	group,
	handleOpenAllTabs,
	handleDeleteGroup,
	handleDeleteUrl,
	handleOpenTab,
	handleUpdateUrls,
	categoryId, // 親カテゴリIDを受け取る
	isDraggingOver,
}: SortableDomainCardProps) => {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({ id: group.id });
	const [showKeywordModal, setShowKeywordModal] = useState(false);

	const handleSetSubCategory = async (
		groupId: string,
		url: string,
		category: string,
	) => {
		try {
			await setUrlSubCategory(groupId, url, category);
		} catch (error) {
			console.error("子カテゴリ設定エラー:", error);
		}
	};

	const handleSaveKeywords = async (
		groupId: string,
		categoryName: string,
		keywords: string[],
	) => {
		try {
			await setCategoryKeywords(groupId, categoryName, keywords);
			// 即時に自動カテゴライズを実行
			await autoCategorizeTabs(groupId);
		} catch (error) {
			console.error("キーワード設定エラー:", error);
		}
	};

	// 子カテゴリを削除する関数
	const handleDeleteCategory = async (
		groupId: string,
		categoryName: string,
	) => {
		try {
			// グループのタブ情報を取得
			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
			const groupToUpdate = savedTabs.find((g: TabGroup) => g.id === groupId);

			if (!groupToUpdate) return;

			// 選択されたカテゴリに属するURLの子カテゴリをリセット
			const updatedUrls = groupToUpdate.urls.map(
				(url: { subCategory: string }) => {
					if (url.subCategory === categoryName) {
						return { ...url, subCategory: undefined };
					}
					return url;
				},
			);

			// 子カテゴリリストと関連キーワードからカテゴリを削除
			const updatedSubCategories = (groupToUpdate.subCategories || []).filter(
				(cat: string) => cat !== categoryName,
			);

			const updatedCategoryKeywords = (
				groupToUpdate.categoryKeywords || []
			).filter(
				(ck: { categoryName: string }) => ck.categoryName !== categoryName,
			);

			// グループを更新
			const updatedGroup = {
				...groupToUpdate,
				urls: updatedUrls,
				subCategories: updatedSubCategories,
				categoryKeywords: updatedCategoryKeywords,
			};

			// 保存
			const updatedTabs = savedTabs.map((g: TabGroup) =>
				g.id === groupId ? updatedGroup : g,
			);

			await chrome.storage.local.set({ savedTabs: updatedTabs });
			console.log(`カテゴリ "${categoryName}" を削除しました`);
		} catch (error) {
			console.error("カテゴリ削除エラー:", error);
		}
	};

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`bg-white rounded-lg shadow-md p-4 border ${
				isDraggingOver ? "border-blue-500 border-2" : "border-gray-200"
			}`}
			data-category-id={categoryId} // データ属性として親カテゴリIDを設定
		>
			<div className="flex justify-between items-center mb-3">
				<div
					className="flex items-center gap-3 cursor-move"
					{...attributes}
					{...listeners}
				>
					<div className="text-gray-500 mr-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							fill="currentColor"
							viewBox="0 0 16 16"
						>
							<title>ドラッグして並び替え</title>
							<path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
						</svg>
					</div>
					<h2 className="text-lg font-semibold text-gray-700 break-all">
						{group.domain}
					</h2>
					<span className="text-sm text-gray-500">
						({group.urls.length}個のタブ)
					</span>
					{group.subCategories && group.subCategories.length > 0 && (
						<span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded mr-2">
							{group.subCategories.length}カテゴリ
						</span>
					)}
				</div>

				{/* 単一のカテゴリ管理ボタン */}
				<div className="flex items-center space-x-2">
					<button
						type="button"
						onClick={() => setShowKeywordModal(true)}
						className="text-sm bg-indigo-500 text-white px-3 py-1 rounded mr-2 hover:bg-indigo-600 flex items-center"
						title="カテゴリ管理"
					>
						<span className="mr-1">⚙</span>
						カテゴリ管理
					</button>

					<button
						type="button"
						onClick={() => handleOpenAllTabs(group.urls)}
						className="text-sm bg-blue-500 text-white px-3 py-1 rounded mr-2 hover:bg-blue-600"
					>
						すべて開く
					</button>
					<button
						type="button"
						onClick={() => handleDeleteGroup(group.id)}
						className="text-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
					>
						削除
					</button>
				</div>
			</div>

			{showKeywordModal && (
				<CategoryKeywordModal
					group={group}
					isOpen={showKeywordModal}
					onClose={() => setShowKeywordModal(false)}
					onSave={handleSaveKeywords}
					onDeleteCategory={handleDeleteCategory}
				/>
			)}

			<UrlList
				items={group.urls}
				groupId={group.id}
				subCategories={group.subCategories}
				handleDeleteUrl={handleDeleteUrl}
				handleOpenTab={handleOpenTab}
				handleUpdateUrls={handleUpdateUrls}
				handleSetSubCategory={handleSetSubCategory}
			/>
		</div>
	);
};

// URL項目用のソータブルコンポーネント
interface SortableUrlItemProps {
	url: string;
	title: string;
	id: string;
	groupId: string;
	subCategory?: string;
	availableSubCategories?: string[];
	handleDeleteUrl: (groupId: string, url: string) => void;
	handleOpenTab: (url: string) => void;
	handleSetSubCategory?: (
		groupId: string,
		url: string,
		subCategory: string,
	) => void;
}

const SortableUrlItem = ({
	url,
	title,
	id,
	groupId,
	subCategory,
	availableSubCategories = [],
	handleDeleteUrl,
	handleOpenTab,
	handleSetSubCategory,
}: SortableUrlItemProps) => {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({ id });

	const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [leftWindow, setLeftWindow] = useState(false);
	const dragTimeoutRef = useRef<number | null>(null);

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

	const handleSubCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const category = e.target.value === "none" ? "" : e.target.value;
		if (handleSetSubCategory) {
			handleSetSubCategory(groupId, url, category);
		}
	};

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<li
			ref={setNodeRef}
			style={style}
			className="border-b border-gray-100 pb-2 last:border-0 last:pb-0 flex items-center"
		>
			<div
				className="text-gray-400 cursor-move mr-2"
				{...attributes}
				{...listeners}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					fill="currentColor"
					viewBox="0 0 16 16"
				>
					<title>ドラッグして並び替え</title>
					<path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm0-3a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm0 6a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm6-6a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm0 3a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm0 3a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm6-6a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm0 3a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm0 3a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z" />
				</svg>
			</div>
			<button
				type="button"
				onClick={() => handleDeleteUrl(groupId, url)}
				className="text-sm bg-red-500 text-white px-2 py-1 rounded mr-2 hover:bg-red-600"
			>
				X
			</button>
			{availableSubCategories.length > 0 && handleSetSubCategory && (
				<div className="relative mr-2">
					<button
						type="button"
						onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
						className={`text-xs px-2 py-1 rounded ${subCategory ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
						title="カテゴリを設定"
					>
						{subCategory || "カテゴリ"}
					</button>
					{showCategoryDropdown && (
						<div className="absolute top-full left-0 z-10 mt-1 bg-white border rounded shadow-lg p-1 min-w-[150px]">
							<select
								value={subCategory || "none"}
								onChange={handleSubCategoryChange}
								className="w-full p-1 border rounded text-sm"
								ref={(select) => select?.focus()}
								onBlur={() => setShowCategoryDropdown(false)}
							>
								<option value="none">未分類</option>
								{availableSubCategories.map((cat) => (
									<option key={cat} value={cat}>
										{cat}
									</option>
								))}
							</select>
						</div>
					)}
				</div>
			)}
			<button
				type="button"
				draggable="true"
				onDragStart={(e) => handleDragStart(e, url as string)}
				onDragEnd={handleDragEnd}
				onClick={() => handleOpenTab(url)}
				className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer truncate text-left w-full bg-transparent border-0"
				title={title}
			>
				{title || url}
			</button>
		</li>
	);
};

// カード内のURL一覧
interface UrlListProps {
	items: TabGroup["urls"];
	groupId: string;
	subCategories?: string[];
	handleDeleteUrl: (groupId: string, url: string) => void;
	handleOpenTab: (url: string) => void;
	handleUpdateUrls: (groupId: string, updatedUrls: TabGroup["urls"]) => void;
	handleSetSubCategory?: (
		groupId: string,
		url: string,
		subCategory: string,
	) => void;
}

const UrlList = ({
	items,
	groupId,
	subCategories = [],
	handleDeleteUrl,
	handleOpenTab,
	handleUpdateUrls,
	handleSetSubCategory,
}: UrlListProps) => {
	const [urls, setUrls] = useState(items);
	const [activeSubCategory, setActiveSubCategory] = useState<string | null>(
		null,
	);

	useEffect(() => {
		setUrls(items);
	}, [items]);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			setUrls((items) => {
				const oldIndex = items.findIndex((item) => item.url === active.id);
				const newIndex = items.findIndex((item) => item.url === over.id);

				const newUrls = arrayMove(items, oldIndex, newIndex);

				// 親コンポーネント経由でストレージに保存
				handleUpdateUrls(groupId, newUrls);

				return newUrls;
			});
		}
	};

	// 表示するURLをフィルタリング
	let filteredUrls = urls;
	if (activeSubCategory === "__uncategorized") {
		filteredUrls = urls.filter((url) => !url.subCategory);
	} else if (activeSubCategory) {
		filteredUrls = urls.filter((url) => url.subCategory === activeSubCategory);
	}

	// サブカテゴリをカウント
	const subCategoryCounts = urls.reduce(
		(acc, url) => {
			if (url.subCategory) {
				acc[url.subCategory] = (acc[url.subCategory] || 0) + 1;
			}
			return acc;
		},
		{} as Record<string, number>,
	);

	// 未分類のアイテム数
	const uncategorizedCount = urls.filter((url) => !url.subCategory).length;

	return (
		<>
			{subCategories.length > 0 && (
				<div className="flex flex-wrap gap-2 mb-3">
					<button
						type="button"
						onClick={() => setActiveSubCategory(null)}
						className={`px-2 py-1 text-xs rounded ${
							activeSubCategory === null
								? "bg-blue-500 text-white"
								: "bg-gray-100 hover:bg-gray-200"
						}`}
					>
						すべて ({urls.length})
					</button>
					{[...subCategories]
						.sort(
							(a, b) =>
								(subCategoryCounts[b] || 0) - (subCategoryCounts[a] || 0),
						)
						.map((category) => (
							<button
								type="button"
								key={category}
								onClick={() => setActiveSubCategory(category)}
								className={`px-2 py-1 text-xs rounded ${
									activeSubCategory === category
										? "bg-blue-500 text-white"
										: "bg-gray-100 hover:bg-gray-200"
								}`}
							>
								{category} ({subCategoryCounts[category] || 0})
							</button>
						))}
					{uncategorizedCount > 0 && (
						<button
							type="button"
							onClick={() => setActiveSubCategory("__uncategorized")}
							className={`px-2 py-1 text-xs rounded ${
								activeSubCategory === "__uncategorized"
									? "bg-blue-500 text-white"
									: "bg-gray-100 hover:bg-gray-200"
							}`}
						>
							未分類 ({uncategorizedCount})
						</button>
					)}
				</div>
			)}

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
			>
				<SortableContext
					items={filteredUrls.map((item) => item.url)}
					strategy={verticalListSortingStrategy}
				>
					<ul className="space-y-2">
						{filteredUrls.map((item) => (
							<SortableUrlItem
								key={item.url}
								id={item.url}
								url={item.url}
								title={item.title}
								groupId={groupId}
								subCategory={item.subCategory}
								availableSubCategories={subCategories}
								handleDeleteUrl={handleDeleteUrl}
								handleOpenTab={handleOpenTab}
								handleSetSubCategory={handleSetSubCategory}
							/>
						))}
					</ul>
				</SortableContext>
			</DndContext>
		</>
	);
};

// カテゴリキーワード管理モーダルコンポーネント
interface CategoryKeywordModalProps {
	group: TabGroup;
	isOpen: boolean;
	onClose: () => void;
	onSave: (groupId: string, categoryName: string, keywords: string[]) => void;
	onDeleteCategory: (groupId: string, categoryName: string) => void;
}

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
	const [newSubCategory, setNewSubCategory] = useState(""); // 子カテゴリ追加用の状態
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // 削除確認状態

	useEffect(() => {
		if (isOpen && activeCategory) {
			// 選択されたカテゴリのキーワードを読み込む
			const categoryKeywords = group.categoryKeywords?.find(
				(ck) => ck.categoryName === activeCategory,
			);
			setKeywords(categoryKeywords?.keywords || []);
		}
	}, [isOpen, activeCategory, group]);

	// キーワードを追加した時に重複チェックを追加
	const handleAddKeyword = () => {
		if (newKeyword.trim()) {
			// 重複チェックを追加
			if (
				keywords.some(
					(keyword) =>
						keyword.toLowerCase() === newKeyword.trim().toLowerCase(),
				)
			) {
				alert("このキーワードは既に追加されています");
				return;
			}

			const updatedKeywords = [...keywords, newKeyword.trim()];
			setKeywords(updatedKeywords);
			setNewKeyword("");

			// 即座に保存
			onSave(group.id, activeCategory, updatedKeywords);
		}
	};

	// キーワードを削除した時に自動保存するよう変更
	const handleRemoveKeyword = (keywordToRemove: string) => {
		const updatedKeywords = keywords.filter((k) => k !== keywordToRemove);
		setKeywords(updatedKeywords);

		// 即座に保存
		onSave(group.id, activeCategory, updatedKeywords);
	};

	// モーダルを閉じる前に確認
	const handleClose = () => {
		onClose();
	};

	// 子カテゴリ追加機能 - フォーカスが外れた時に実行
	const handleAddSubCategory = async () => {
		if (newSubCategory.trim()) {
			try {
				await addSubCategoryToGroup(group.id, newSubCategory.trim());
				// カテゴリを追加したら、それをアクティブにする
				setActiveCategory(newSubCategory.trim());
				setNewSubCategory("");

				// カテゴリが追加されたので、groupを更新する必要がある
				// この更新はストレージの変更リスナーにより自動的に行われる
			} catch (error) {
				console.error("子カテゴリ追加エラー:", error);
			}
		}
	};

	// カテゴリを削除する関数
	const handleDeleteCategory = async () => {
		if (!activeCategory) return;

		try {
			await onDeleteCategory(group.id, activeCategory);

			// 削除後は別のカテゴリを選択
			if (group.subCategories && group.subCategories.length > 1) {
				// 削除したカテゴリ以外のカテゴリを選択
				const nextCategory = group.subCategories.find(
					(cat) => cat !== activeCategory,
				);
				if (nextCategory) {
					setActiveCategory(nextCategory);
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
	}, []); // activeCategory は不要

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-semibold">
						「{group.domain}」のカテゴリ管理
					</h3>
					{/* モーダル閉じるボタン */}
					<button
						type="button"
						onClick={handleClose}
						className="text-gray-500 hover:text-gray-700"
						aria-label="閉じる"
					>
						×
					</button>
				</div>

				{/* 子カテゴリ追加セクション - ボタンを削除しblurイベントを追加 */}
				<div className="mb-4 border-b pb-4">
					<h4 className="text-md font-medium mb-2">新しい子カテゴリを追加</h4>
					<div className="flex">
						<input
							type="text"
							value={newSubCategory}
							onChange={(e) => setNewSubCategory(e.target.value)}
							placeholder="新しいカテゴリ名を入力してEnterキーまたはフォーカスを外す"
							className="flex-grow p-2 border rounded"
							onKeyPress={(e) => e.key === "Enter" && handleAddSubCategory()}
							onBlur={handleAddSubCategory}
						/>
					</div>
				</div>

				{group.subCategories && group.subCategories.length > 0 ? (
					<>
						<div className="mb-4">
							<div className="flex justify-between items-center mb-2">
								<label
									htmlFor="category-select"
									className="block text-sm text-gray-600"
								>
									キーワード設定を行うカテゴリを選択
								</label>

								{/* カテゴリの削除ボタン */}
								<button
									type="button"
									onClick={() => setShowDeleteConfirm(true)}
									className="text-sm bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
									disabled={!activeCategory}
								>
									現在のカテゴリを削除
								</button>
							</div>

							{/* 削除確認UI */}
							{showDeleteConfirm && (
								<div className="mt-2 p-3 border border-red-300 bg-red-50 rounded mb-3">
									<p className="text-red-700 mb-2">
										「{activeCategory}」カテゴリを削除しますか？
										<br />
										<span className="text-xs">
											このカテゴリに属するすべてのタブは未分類になります
										</span>
									</p>
									<div className="flex justify-end gap-2">
										<button
											type="button"
											onClick={() => setShowDeleteConfirm(false)}
											className="text-sm bg-gray-300 hover:bg-gray-400 px-2 py-1 rounded"
										>
											キャンセル
										</button>
										<button
											type="button"
											onClick={handleDeleteCategory}
											className="text-sm bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
										>
											削除する
										</button>
									</div>
								</div>
							)}

							<select
								id="category-select"
								value={activeCategory}
								onChange={(e) => setActiveCategory(e.target.value)}
								className="w-full p-2 border rounded"
							>
								{group.subCategories.map((cat) => (
									<option key={cat} value={cat}>
										{cat}
									</option>
								))}
							</select>
						</div>

						<div className="mb-4">
							<label
								htmlFor="keyword-input"
								className="block text-sm text-gray-600 mb-2"
							>
								「{activeCategory}」カテゴリのキーワード
								<span className="text-xs text-gray-500 ml-2">
									（タイトルにこれらの単語が含まれていると自動的にこのカテゴリに分類されます）
								</span>
							</label>

							{/* キーワード入力 - ボタンを削除しblurイベントを追加 */}
							<div className="mb-2">
								<input
									id="keyword-input"
									type="text"
									value={newKeyword}
									onChange={(e) => setNewKeyword(e.target.value)}
									placeholder="新しいキーワードを入力してEnterキーまたはフォーカスを外す"
									className="w-full p-2 border rounded"
									onKeyPress={(e) => e.key === "Enter" && handleAddKeyword()}
									onBlur={handleAddKeyword}
								/>
							</div>

							<div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border rounded bg-gray-50">
								{keywords.length === 0 ? (
									<p className="text-gray-500">キーワードがありません</p>
								) : (
									keywords.map((keyword) => (
										<div
											key={keyword}
											className="bg-blue-100 text-blue-800 px-2 py-1 rounded flex items-center"
										>
											{keyword}
											<button
												type="button"
												onClick={() => handleRemoveKeyword(keyword)}
												className="ml-1 text-blue-600 hover:text-blue-800"
											>
												×
											</button>
										</div>
									))
								)}
							</div>
						</div>
					</>
				) : (
					<p className="text-yellow-600 mb-4">
						このドメインには子カテゴリがありません。上記のフォームから子カテゴリを追加してください。
					</p>
				)}

				<div className="flex justify-end">
					<button
						type="button"
						onClick={handleClose}
						className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
					>
						完了
					</button>
				</div>
			</div>
		</div>
	);
};

const SavedTabs = () => {
	const [tabGroups, setTabGroups] = useState<TabGroup[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [settings, setSettings] = useState<UserSettings>({
		removeTabAfterOpen: false,
		excludePatterns: [],
		enableCategories: false,
	});
	const [categories, setCategories] = useState<ParentCategory[]>([]);
	const [newSubCategory, setNewSubCategory] = useState("");
	const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
	const [showSubCategoryModal, setShowSubCategoryModal] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

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

				// 専用の削除前処理関数を呼び出し
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

	// 子カテゴリを追加するモーダルを表示
	const showAddSubCategoryModal = (groupId: string) => {
		setActiveGroupId(groupId);
		setNewSubCategory("");
		setShowSubCategoryModal(true);
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

	// URLの子カテゴリを設定
	const handleSetSubCategory = async (
		groupId: string,
		url: string,
		subCategory: string,
	) => {
		try {
			await setUrlSubCategory(groupId, url, subCategory);
		} catch (error) {
			console.error("子カテゴリ設定エラー:", error);
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

	// 親カテゴリの順序変更ハンドラを追加
	const handleCategoryDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			const oldIndex = categories.findIndex((cat) => cat.id === active.id);
			const newIndex = categories.findIndex((cat) => cat.id === over.id);

			if (oldIndex !== -1 && newIndex !== -1) {
				const updatedCategories = arrayMove(categories, oldIndex, newIndex);
				setCategories(updatedCategories);
				await saveParentCategories(updatedCategories);
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

	// ドメインカードのドラッグスタート処理を追加
	const handleDomainDragStart = (
		e: React.DragEvent,
		domainId: string,
		categoryId: string,
	) => {
		e.dataTransfer.setData("domain-id", domainId);
		e.dataTransfer.setData("from-category-id", categoryId);
		e.dataTransfer.effectAllowed = "move";
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex justify-between items-center mb-8">
				<h1 className="text-3xl font-bold text-gray-800">保存したタブ</h1>
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={() => chrome.runtime.openOptionsPage()}
						className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded flex items-center gap-2"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							fill="currentColor"
							viewBox="0 0 16 16"
						>
							<title>設定アイコン</title>
							<path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
							<path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z" />
						</svg>
						設定
					</button>
					<div className="text-sm text-gray-500 space-x-4">
						<span>
							合計タブ数:
							{tabGroups.reduce((sum, group) => sum + group.urls.length, 0)}個
						</span>
						<span>ドメイン数: {tabGroups.length}個</span>
					</div>
				</div>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center min-h-[300px]">
					<div className="text-xl text-gray-600">読み込み中...</div>
				</div>
			) : tabGroups.length === 0 ? (
				<div className="flex flex-col items-center justify-center min-h-[300px]">
					<div className="text-2xl text-gray-600 mb-4">
						保存されたタブはありません
					</div>
					<div className="text-gray-500">
						タブを右クリックして保存するか、拡張機能のアイコンをクリックしてください
					</div>
				</div>
			) : (
				<>
					{settings.enableCategories && Object.keys(categorized).length > 0 && (
						<>
							<DndContext
								sensors={sensors}
								collisionDetection={closestCenter}
								onDragEnd={handleCategoryDragEnd}
							>
								<SortableContext
									items={categories.map((category) => category.id)}
									strategy={verticalListSortingStrategy}
								>
									{categories.map((category) => {
										const domainGroups = categorized[category.id] || [];
										if (domainGroups.length === 0) return null;

										return (
											<CategoryGroup
												key={category.id}
												category={category}
												domains={domainGroups}
												handleOpenAllTabs={handleOpenAllTabs}
												handleDeleteGroup={handleDeleteGroup}
												handleDeleteUrl={handleDeleteUrl}
												handleOpenTab={handleOpenTab}
												handleUpdateUrls={handleUpdateUrls}
												handleUpdateDomainsOrder={handleUpdateDomainsOrder}
												handleMoveDomainToCategory={handleMoveDomainToCategory}
											/>
										);
									})}
								</SortableContext>
							</DndContext>

							{uncategorized.length > 0 && (
								<div className="mt-8 mb-4">
									<h2 className="text-xl font-bold text-gray-800 mb-4">
										未分類のドメイン
									</h2>
								</div>
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
							<div className="flex flex-col gap-6">
								{uncategorized.map((group) => (
									<SortableDomainCard
										key={group.id}
										group={group}
										handleOpenAllTabs={handleOpenAllTabs}
										handleDeleteGroup={handleDeleteGroup}
										handleDeleteUrl={handleDeleteUrl}
										handleOpenTab={handleOpenTab}
										handleUpdateUrls={handleUpdateUrls}
									/>
								))}
							</div>
						</SortableContext>
					</DndContext>
				</>
			)}

			{/* 子カテゴリ追加モーダル */}
			{showSubCategoryModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
						<h3 className="text-lg font-semibold mb-4">
							新しい子カテゴリを追加
						</h3>
						<input
							type="text"
							value={newSubCategory}
							onChange={(e) => setNewSubCategory(e.target.value)}
							placeholder="カテゴリ名を入力"
							className="w-full p-2 border rounded mb-4"
							ref={inputRef}
						/>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setShowSubCategoryModal(false)}
								className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
							>
								キャンセル
							</button>
							<button
								type="button"
								onClick={handleAddSubCategory}
								className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
							>
								追加
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

// タブグループ削除前の処理関数 (存在しないため追加)
const handleTabGroupRemoval = async (groupId: string) => {
	try {
		const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
		const groupToDelete = savedTabs.find(
			(group: TabGroup) => group.id === groupId,
		);

		if (groupToDelete) {
			// 子カテゴリ設定を保存
			await updateDomainCategorySettings(
				groupToDelete.domain,
				groupToDelete.subCategories || [],
				groupToDelete.categoryKeywords || [],
			);
		}
	} catch (error) {
		console.error("タブグループ削除前処理エラー:", error);
	}
};

// Reactコンポーネントをレンダリング
document.addEventListener("DOMContentLoaded", () => {
	const appContainer = document.getElementById("app");
	if (!appContainer) throw new Error("Failed to find the app container");

	const root = createRoot(appContainer);
	root.render(<SavedTabs />);
});
