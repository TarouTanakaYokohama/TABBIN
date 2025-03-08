import "@/assets/tailwind.css";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { TabGroup } from "../../utils/storage";
import { getUserSettings } from "../../utils/storage";
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
							viewBox="0 0 16 16"
						>
							<title>ドラッグして並び替え</title>
							<path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
						</svg>
					</div>
					<h2 className="text-lg font-semibold text-gray-700">
						{group.domain}
					</h2>
					<span className="text-sm text-gray-500">
						({group.urls.length}個のタブ)
					</span>
				</div>
				<div>
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

			<UrlList
				items={group.urls}
				groupId={group.id}
				handleDeleteUrl={handleDeleteUrl}
				handleOpenTab={handleOpenTab}
				handleUpdateUrls={handleUpdateUrls}
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
	handleDeleteUrl: (groupId: string, url: string) => void;
	handleOpenTab: (url: string) => void;
}

const SortableUrlItem = ({
	url,
	title,
	id,
	groupId,
	handleDeleteUrl,
	handleOpenTab,
}: SortableUrlItemProps) => {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({ id });

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
			<button
				type="button"
				onClick={() => handleOpenTab(url)}
				className="text-blue-600 hover:text-blue-800 hover:underline block truncate text-left w-full"
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
	handleDeleteUrl: (groupId: string, url: string) => void;
	handleOpenTab: (url: string) => void;
	handleUpdateUrls: (groupId: string, updatedUrls: TabGroup["urls"]) => void;
}

const UrlList = ({
	items,
	groupId,
	handleDeleteUrl,
	handleOpenTab,
	handleUpdateUrls,
}: UrlListProps) => {
	const [urls, setUrls] = useState(items);

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

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragEnd={handleDragEnd}
		>
			<SortableContext
				items={urls.map((item) => item.url)}
				strategy={verticalListSortingStrategy}
			>
				<ul className="space-y-2">
					{urls.map((item) => (
						<SortableUrlItem
							key={item.url}
							id={item.url}
							url={item.url}
							title={item.title}
							groupId={groupId}
							handleDeleteUrl={handleDeleteUrl}
							handleOpenTab={handleOpenTab}
						/>
					))}
				</ul>
			</SortableContext>
		</DndContext>
	);
};

const SavedTabs = () => {
	const [tabGroups, setTabGroups] = useState<TabGroup[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [settings, setSettings] = useState({ removeTabAfterOpen: false });

	useEffect(() => {
		const loadSavedTabs = async () => {
			try {
				const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
				console.log("読み込まれたタブ:", savedTabs);
				setTabGroups(savedTabs);

				// ユーザー設定を読み込み
				const userSettings = await getUserSettings();
				setSettings(userSettings);
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

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex justify-between items-center mb-8">
				<h1 className="text-3xl font-bold text-gray-800">保存したタブ</h1>
				<div className="text-sm text-gray-500 space-x-4">
					<span>
						合計タブ数:
						{tabGroups.reduce((sum, group) => sum + group.urls.length, 0)}個
					</span>
					<span>ドメイン数: {tabGroups.length}個</span>
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
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={tabGroups.map((group) => group.id)}
						strategy={verticalListSortingStrategy}
					>
						<div className="flex flex-col gap-6">
							{tabGroups.map((group) => (
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
