import "@/assets/tailwind.css";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { TabGroup } from "../../utils/storage";

const SavedTabs = () => {
	const [tabGroups, setTabGroups] = useState<TabGroup[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const loadSavedTabs = async () => {
			try {
				const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
				console.log("読み込まれたタブ:", savedTabs);
				setTabGroups(savedTabs);
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
		});
	}, []);

	const handleOpenTab = (url: string) => {
		window.open(url, "_blank");
	};

	const handleOpenAllTabs = (urls: { url: string; title: string }[]) => {
		for (const { url } of urls) {
			window.open(url, "_blank");
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
				<div className="flex flex-col gap-6">
					{tabGroups.map((group) => (
						<div
							key={group.id}
							className="bg-white rounded-lg shadow-md p-4 border border-gray-200"
						>
							<div className="flex justify-between items-center mb-3">
								<div className="flex items-center gap-3">
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
							<ul className="space-y-2">
								{group.urls.map((item) => (
									<li
										key={item.url}
										className="border-b border-gray-100 pb-2 last:border-0 last:pb-0 flex items-center"
									>
										<button
											type="button"
											onClick={() => handleDeleteUrl(group.id, item.url)}
											className="text-sm bg-red-500 text-white px-2 py-1 rounded mr-2 hover:bg-red-600"
										>
											X
										</button>
										<button
											type="button"
											onClick={() => handleOpenTab(item.url)}
											className="text-blue-600 hover:text-blue-800 hover:underline block truncate text-left w-full"
											title={item.title}
										>
											{item.title || item.url}
										</button>
									</li>
								))}
							</ul>
						</div>
					))}
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
