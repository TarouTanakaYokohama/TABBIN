import "@/assets/tailwind.css";
import { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { TabGroup, ParentCategory } from "../../utils/storage";
import {
	getUserSettings,
	getParentCategories,
	addSubCategoryToGroup,
	setUrlSubCategory,
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
}

const CategoryGroup = ({
	category,
	domains,
	handleOpenAllTabs,
	handleDeleteGroup,
	handleDeleteUrl,
	handleOpenTab,
	handleUpdateUrls,
}: CategoryGroupProps) => {
	const [isCollapsed, setIsCollapsed] = useState(false);

	// このカテゴリ内のすべてのURLを取得
	const allUrls = domains.flatMap((group) => group.urls);

	return (
		<div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
			<div className="flex justify-between items-center mb-3">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setIsCollapsed(!isCollapsed)}
						className="text-gray-700"
					>
						{isCollapsed ? "▶" : "▼"}
					</button>
					<h2 className="text-xl font-bold text-gray-800">{category.name}</h2>
					<span className="text-gray-500">
						({domains.length}ドメイン / {allUrls.length}タブ)
					</span>
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
					{domains.map((group) => (
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
}

const SortableDomainCard = ({
	group,
	handleOpenAllTabs,
	handleDeleteGroup,
	handleDeleteUrl,
	handleOpenTab,
	handleUpdateUrls,
}: SortableDomainCardProps) => {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({ id: group.id });
	const [showAddSubCategory, setShowAddSubCategory] = useState(false);
	const [newSubCategory, setNewSubCategory] = useState("");
	const [showKeywordModal, setShowKeywordModal] = useState(false);

	const handleAddSubCategory = async () => {
		if (newSubCategory.trim()) {
			try {
				await addSubCategoryToGroup(group.id, newSubCategory.trim());
				setNewSubCategory("");
				setShowAddSubCategory(false);
			} catch (error) {
				console.error("子カテゴリ追加エラー:", error);
			}
		}
	};

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

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="bg-white rounded-lg shadow-md p-4 border border-gray-200"
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
							viewBox="0 16 16"
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
				</div>
				<div className="flex items-center">
					{group.subCategories && group.subCategories.length > 0 && (
						<span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded mr-2">
							{group.subCategories.length}カテゴリ
						</span>
					)}
					<button
						type="button"
						onClick={() => setShowAddSubCategory(true)}
						className="text-sm bg-green-500 text-white px-2 py-1 rounded mr-2 hover:bg-green-600"
						title="子カテゴリを追加"
					>
						+
					</button>
					<button
						type="button"
						onClick={() => setShowKeywordModal(true)}
						className="text-sm bg-purple-500 text-white px-2 py-1 rounded mr-2 hover:bg-purple-600"
						title="キーワード設定"
					>
						⚙
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

			{showAddSubCategory && (
				<div className="mb-4 flex">
					<input
						type="text"
						value={newSubCategory}
						onChange={(e) => setNewSubCategory(e.target.value)}
						placeholder="新しいカテゴリ名"
						className="flex-grow p-1 border rounded-l"
					/>
					<button
						type="button"
						onClick={handleAddSubCategory}
						className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-r"
					>
						追加
					</button>
					<button
						type="button"
						onClick={() => setShowAddSubCategory(false)}
						className="ml-2 text-sm bg-gray-300 px-2 py-1 rounded hover:bg-gray-400"
					>
						キャンセル
					</button>
				</div>
			)}

			{showKeywordModal && (
				<CategoryKeywordModal
					group={group}
					isOpen={showKeywordModal}
					onClose={() => setShowKeywordModal(false)}
					onSave={handleSaveKeywords}
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

	const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
		// URLをテキストとして設定
		e.dataTransfer.setData("text/plain", url);
		// URI-listとしても設定（多くのブラウザやアプリがこのフォーマットを認識）
		e.dataTransfer.setData("text/uri-list", url);

		console.log("ドラッグ開始:", url);

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

	const handleDragEnd = (e: React.DragEvent<HTMLButtonElement>) => {
		// ドラッグ終了時にドロップ操作タイプを確認
		console.log(
			"ドラッグ終了時のドロップエフェクト:",
			e.dataTransfer.dropEffect,
		);

		// 外部ウィンドウへのコピー操作の場合のみ削除処理を通知
		// "copy"は外部アプリケーションへのドラッグを意味する
		if (e.dataTransfer.dropEffect === "copy") {
			console.log("外部へのドラッグ&ドロップを検知:", url);

			// 少し遅延を入れて、ドロップ後の処理を通知
			setTimeout(() => {
				chrome.runtime.sendMessage(
					{
						action: "urlDropped",
						url: url,
						groupId: groupId,
						fromExternal: true, // 外部操作フラグを追加
					},
					(response) => {
						console.log("ドラッグ&ドロップ後の応答:", response);
					},
				);
			}, 500);
		} else {
			// 内部ドラッグか操作キャンセル（"none"）の場合
			console.log(
				"内部操作またはキャンセル - 削除しません:",
				e.dataTransfer.dropEffect,
			);
		}
	};

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
				onDragStart={handleDragStart}
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
					{subCategories.map((category) => (
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
}

const CategoryKeywordModal = ({
	group,
	isOpen,
	onClose,
	onSave,
}: CategoryKeywordModalProps) => {
	const [activeCategory, setActiveCategory] = useState<string>(
		group.subCategories && group.subCategories.length > 0
			? group.subCategories[0]
			: "",
	);
	const [keywords, setKeywords] = useState<string[]>([]);
	const [newKeyword, setNewKeyword] = useState("");

	useEffect(() => {
		if (isOpen && activeCategory) {
			// 選択されたカテゴリのキーワードを読み込む
			const categoryKeywords = group.categoryKeywords?.find(
				(ck) => ck.categoryName === activeCategory,
			);
			setKeywords(categoryKeywords?.keywords || []);
		}
	}, [isOpen, activeCategory, group]);

	const handleAddKeyword = () => {
		if (newKeyword.trim()) {
			setKeywords([...keywords, newKeyword.trim()]);
			setNewKeyword("");
		}
	};

	const handleRemoveKeyword = (keywordToRemove: string) => {
		setKeywords(keywords.filter((k) => k !== keywordToRemove));
	};

	const handleSave = () => {
		onSave(group.id, activeCategory, keywords);
		onClose();
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
				<h3 className="text-lg font-semibold mb-4">
					「{group.domain}」のカテゴリキーワード設定
				</h3>

				{group.subCategories && group.subCategories.length > 0 ? (
					<>
						<div className="mb-4">
							<label
								htmlFor="category-select"
								className="block text-sm text-gray-600 mb-2"
							>
								カテゴリ選択
							</label>
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

							<div className="flex mb-2">
								<input
									id="keyword-input"
									type="text"
									value={newKeyword}
									onChange={(e) => setNewKeyword(e.target.value)}
									placeholder="新しいキーワードを入力"
									className="flex-grow p-2 border rounded-l"
								/>
								<button
									type="button"
									onClick={handleAddKeyword}
									className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-r"
								>
									追加
								</button>
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
						このドメインには子カテゴリがありません。まず子カテゴリを追加してください。
					</p>
				)}

				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
					>
						キャンセル
					</button>
					{group.subCategories && group.subCategories.length > 0 && (
						<button
							type="button"
							onClick={handleSave}
							className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
						>
							保存
						</button>
					)}
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

	useEffect(() => {
		const loadSavedTabs = async () => {
			try {
				const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
				console.log("読み込まれたタブ:", savedTabs);
				setTabGroups(savedTabs);

				// ユーザー設定を読み込み
				const userSettings = await getUserSettings();
				setSettings(userSettings);

				// カテゴリを読み込み
				const parentCategories = await getParentCategories();
				setCategories(parentCategories);
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

	const handleOpenAllTabs = async (urls: { url: string; title: string }[]) => {
		for (const { url } of urls) {
			window.open(url, "_blank");
		}

		// 設定に基づいて、開いたタブグループを削除するかどうかを決定
		if (settings.removeTabAfterOpen) {
			// 開いたすべてのタブを含むグループを削除する処理
			const urlSet = new Set(urls.map((item) => item.url));

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
	};

	const handleDeleteGroup = async (id: string) => {
		const updatedGroups = tabGroups.filter((group) => group.id !== id);
		setTabGroups(updatedGroups);
		await chrome.storage.local.set({ savedTabs: updatedGroups });

		// 親カテゴリからも削除
		const updatedCategories = categories.map((category) => ({
			...category,
			domains: category.domains.filter((domainId) => domainId !== id),
		}));
		await saveParentCategories(updatedCategories);
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

	// タブグループをカテゴリごとに整理
	const organizeTabGroups = () => {
		if (!settings.enableCategories) {
			// カテゴリ機能が無効の場合は通常表示
			return { categorized: {}, uncategorized: tabGroups };
		}

		// カテゴリに属するドメインとカテゴリに属さないドメインに分ける
		const categorizedGroups: Record<string, TabGroup[]> = {};
		const uncategorizedGroups: TabGroup[] = [];

		for (const group of tabGroups) {
			// このグループが属するカテゴリを探す
			let found = false;

			for (const category of categories) {
				if (category.domains.includes(group.id)) {
					if (!categorizedGroups[category.id]) {
						categorizedGroups[category.id] = [];
					}
					categorizedGroups[category.id].push(group);
					found = true;
					break;
				}
			}

			if (!found) {
				uncategorizedGroups.push(group);
			}
		}

		return {
			categorized: categorizedGroups,
			uncategorized: uncategorizedGroups,
		};
	};

	const { categorized, uncategorized } = organizeTabGroups();

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
									/>
								);
							})}

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

// Reactコンポーネントをレンダリング
document.addEventListener("DOMContentLoaded", () => {
	const appContainer = document.getElementById("app");
	if (!appContainer) throw new Error("Failed to find the app container");

	const root = createRoot(appContainer);
	root.render(<SavedTabs />);
});
