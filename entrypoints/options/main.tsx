import "@/assets/tailwind.css";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getUserSettings, saveUserSettings } from "../../utils/storage";
import type {
	UserSettings,
	ParentCategory,
	TabGroup,
} from "../../utils/storage";
import {
	defaultSettings,
	getParentCategories,
	saveParentCategories,
	createParentCategory,
	setCategoryKeywords,
} from "../../utils/storage";

const SubCategoryKeywordManager = ({ tabGroup }: { tabGroup: TabGroup }) => {
	const [activeCategory, setActiveCategory] = useState<string | null>(null);
	const [keywords, setKeywords] = useState<string[]>([]);
	const [newKeyword, setNewKeyword] = useState("");

	const handleCategorySelect = (categoryName: string) => {
		setActiveCategory(categoryName);
		const categoryKeywords = tabGroup.categoryKeywords?.find(
			(ck) => ck.categoryName === categoryName,
		);
		setKeywords(categoryKeywords?.keywords || []);
	};

	const handleAddKeyword = () => {
		if (newKeyword.trim() && activeCategory) {
			const updatedKeywords = [...keywords, newKeyword.trim()];
			setKeywords(updatedKeywords);
			setCategoryKeywords(tabGroup.id, activeCategory, updatedKeywords)
				.then(() => setNewKeyword(""))
				.catch((err) => console.error("キーワード保存エラー:", err));
		}
	};

	const handleRemoveKeyword = (keywordToRemove: string) => {
		if (activeCategory) {
			const updatedKeywords = keywords.filter((k) => k !== keywordToRemove);
			setKeywords(updatedKeywords);
			setCategoryKeywords(tabGroup.id, activeCategory, updatedKeywords).catch(
				(err) => console.error("キーワード削除エラー:", err),
			);
		}
	};

	if (!tabGroup.subCategories || tabGroup.subCategories.length === 0) {
		return (
			<p className="text-gray-500">このドメインには子カテゴリがありません。</p>
		);
	}

	return (
		<div className="mt-4 border-t pt-4">
			<h4 className="text-md font-medium mb-2">子カテゴリキーワード管理</h4>
			<div className="flex gap-2 mb-3">
				{tabGroup.subCategories.map((category) => (
					<button
						key={category}
						type="button"
						onClick={() => handleCategorySelect(category)}
						className={`px-2 py-1 text-sm rounded ${
							activeCategory === category
								? "bg-blue-500 text-white"
								: "bg-gray-100 hover:bg-gray-200"
						}`}
					>
						{category}
					</button>
				))}
			</div>

			{activeCategory && (
				<div className="mt-2">
					<div className="mb-2">
						<label
							htmlFor={`keyword-input-${activeCategory}`}
							className="block text-sm text-gray-600 mb-1"
						>
							「{activeCategory}」カテゴリのキーワード
						</label>
						<div className="flex">
							<input
								id={`keyword-input-${activeCategory}`}
								type="text"
								value={newKeyword}
								onChange={(e) => setNewKeyword(e.target.value)}
								placeholder="新しいキーワードを入力"
								className="flex-grow p-1 border rounded-l"
							/>
							<button
								type="button"
								onClick={handleAddKeyword}
								className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-r"
							>
								追加
							</button>
						</div>
					</div>

					<div className="flex flex-wrap gap-2 mt-2">
						{keywords.length === 0 ? (
							<p className="text-gray-500 text-sm">キーワードがありません</p>
						) : (
							keywords.map((keyword) => (
								<div
									key={keyword}
									className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm flex items-center"
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
			)}
		</div>
	);
};

const OptionsPage = () => {
	const [settings, setSettings] = useState<UserSettings>(defaultSettings);
	const [isSaved, setIsSaved] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [parentCategories, setParentCategories] = useState<ParentCategory[]>(
		[],
	);
	const [savedTabs, setSavedTabs] = useState<TabGroup[]>([]);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
		null,
	);
	const [editingCategoryName, setEditingCategoryName] = useState("");
	const [activeTabId, setActiveTabId] = useState<string | null>(null);

	useEffect(() => {
		const loadData = async () => {
			try {
				const userSettings = await getUserSettings();
				setSettings(userSettings);

				const categories = await getParentCategories();
				setParentCategories(categories);

				const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
				setSavedTabs(savedTabs);
			} catch (error) {
				console.error("設定の読み込みエラー:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadData();

		// ストレージが変更されたときに再読み込み
		chrome.storage.onChanged.addListener((changes) => {
			if (changes.userSettings) {
				setSettings((prev) => ({ ...prev, ...changes.userSettings.newValue }));
			}
			if (changes.parentCategories) {
				setParentCategories(changes.parentCategories.newValue || []);
			}
			if (changes.savedTabs) {
				setSavedTabs(changes.savedTabs.newValue || []);
			}
		});
	}, []);

	const handleSaveSettings = async () => {
		try {
			// 保存する前に空の行を除外
			const cleanSettings = {
				...settings,
				excludePatterns: settings.excludePatterns.filter((p) => p.trim()),
			};
			await saveUserSettings(cleanSettings);
			setIsSaved(true);
			setTimeout(() => setIsSaved(false), 2000);
		} catch (error) {
			console.error("設定の保存エラー:", error);
		}
	};

	const handleToggleRemoveAfterOpen = (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		setSettings((prev) => ({
			...prev,
			removeTabAfterOpen: e.target.checked,
		}));
	};

	const handleToggleEnableCategories = (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		setSettings((prev) => ({
			...prev,
			enableCategories: e.target.checked,
		}));
	};

	const handleExcludePatternsChange = (
		e: React.ChangeEvent<HTMLTextAreaElement>,
	) => {
		// 空の行も含めて全ての行を保持
		const patterns = e.target.value.split("\n");
		setSettings((prev) => ({
			...prev,
			excludePatterns: patterns,
		}));
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter") {
			// Enterキーのデフォルトの動作（改行）を許可し、
			// もし他にイベントハンドラがあれば伝播を止めておく
			e.stopPropagation();
		}
	};

	// 新しいカテゴリを追加
	const handleAddCategory = async () => {
		if (newCategoryName.trim()) {
			try {
				await createParentCategory(newCategoryName.trim());
				setNewCategoryName("");
			} catch (error) {
				console.error("カテゴリ追加エラー:", error);
			}
		}
	};

	// カテゴリ名の編集を開始
	const startEditingCategory = (category: ParentCategory) => {
		setEditingCategoryId(category.id);
		setEditingCategoryName(category.name);
	};

	// カテゴリ名の編集を保存
	const saveEditingCategory = async () => {
		if (editingCategoryId && editingCategoryName.trim()) {
			const updatedCategories = parentCategories.map((cat) =>
				cat.id === editingCategoryId
					? { ...cat, name: editingCategoryName.trim() }
					: cat,
			);

			try {
				await saveParentCategories(updatedCategories);
				setEditingCategoryId(null);
				setEditingCategoryName("");
			} catch (error) {
				console.error("カテゴリ編集エラー:", error);
			}
		}
	};

	// カテゴリを削除
	const handleDeleteCategory = async (categoryId: string) => {
		if (confirm("このカテゴリを削除してもよろしいですか？")) {
			const updatedCategories = parentCategories.filter(
				(cat) => cat.id !== categoryId,
			);

			try {
				await saveParentCategories(updatedCategories);

				// 関連するドメインの親カテゴリIDも削除
				const updatedTabs = savedTabs.map((tab) =>
					tab.parentCategoryId === categoryId
						? { ...tab, parentCategoryId: undefined }
						: tab,
				);
				await chrome.storage.local.set({ savedTabs: updatedTabs });
			} catch (error) {
				console.error("カテゴリ削除エラー:", error);
			}
		}
	};

	// ドメインをカテゴリに割り当て
	const assignDomainToCategory = async (
		domainId: string,
		categoryId: string | "none",
	) => {
		// まず全てのカテゴリからこのドメインを削除
		const updatedCategories = parentCategories.map((category) => ({
			...category,
			domains: category.domains.filter((id) => id !== domainId),
		}));

		// 選択されたカテゴリに追加（"none"の場合は追加しない）
		if (categoryId !== "none") {
			const categoryIndex = updatedCategories.findIndex(
				(cat) => cat.id === categoryId,
			);
			if (categoryIndex !== -1) {
				updatedCategories[categoryIndex] = {
					...updatedCategories[categoryIndex],
					domains: [...updatedCategories[categoryIndex].domains, domainId],
				};
			}
		}

		try {
			await saveParentCategories(updatedCategories);

			// タブグループの親カテゴリIDも更新
			const updatedTabs = savedTabs.map((tab) =>
				tab.id === domainId
					? {
							...tab,
							parentCategoryId: categoryId !== "none" ? categoryId : undefined,
						}
					: tab,
			);
			await chrome.storage.local.set({ savedTabs: updatedTabs });
		} catch (error) {
			console.error("ドメイン割り当てエラー:", error);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[300px]">
				<div className="text-xl text-gray-600">読み込み中...</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8 max-w-3xl">
			<h1 className="text-3xl font-bold text-gray-800 mb-8">
				Tab Managerオプション
			</h1>

			<div className="bg-white rounded-lg shadow-md p-6 mb-8">
				<h2 className="text-xl font-semibold text-gray-700 mb-4">
					タブの挙動設定
				</h2>

				<div className="mb-4">
					<label className="flex items-center space-x-2 cursor-pointer">
						<input
							type="checkbox"
							checked={settings.removeTabAfterOpen}
							onChange={handleToggleRemoveAfterOpen}
							className="form-checkbox h-5 w-5 text-blue-500"
						/>
						<span className="text-gray-700">
							保存したタブを開いた後、リストから自動的に削除する
						</span>
					</label>
					<p className="text-sm text-gray-500 mt-1 ml-7">
						オンにすると、保存したタブを開いた後、そのタブは保存リストから自動的に削除されます。
						オフにすると、保存したタブを開いても、リストからは削除されません。
					</p>
				</div>

				<div className="mb-4">
					<label className="flex items-center space-x-2 cursor-pointer">
						<input
							type="checkbox"
							checked={settings.enableCategories}
							onChange={handleToggleEnableCategories}
							className="form-checkbox h-5 w-5 text-blue-500"
						/>
						<span className="text-gray-700">カテゴリ機能を有効にする</span>
					</label>
					<p className="text-sm text-gray-500 mt-1 ml-7">
						オンにすると、ドメインを親カテゴリでグループ化し、URLを子カテゴリで分類できます。
					</p>
				</div>
			</div>

			<div className="bg-white rounded-lg shadow-md p-6 mb-8">
				<h2 className="text-xl font-semibold text-gray-700 mb-4">除外設定</h2>
				<div className="mb-4">
					<label htmlFor="excludePatterns" className="block text-gray-700 mb-2">
						保存・閉じない URL パターン（1行に1つ）
					</label>
					<textarea
						id="excludePatterns"
						value={settings.excludePatterns.join("\n")}
						onChange={handleExcludePatternsChange}
						onKeyDown={handleKeyDown}
						className="w-full h-32 p-2 border rounded focus:ring-2 focus:ring-blue-500"
						placeholder="例：&#10;chrome-extension://&#10;chrome://"
					/>
					<p className="text-sm text-gray-500 mt-1">
						これらのパターンに一致するURLは保存されず、タブも閉じられません。
					</p>
				</div>
			</div>

			{settings.enableCategories && (
				<div className="bg-white rounded-lg shadow-md p-6 mb-8">
					<h2 className="text-xl font-semibold text-gray-700 mb-4">
						カテゴリ管理
					</h2>

					{/* 親カテゴリ管理 */}
					<div className="mb-6">
						<h3 className="text-lg font-medium text-gray-700 mb-3">
							親カテゴリ
						</h3>
						<div className="flex mb-4">
							<input
								type="text"
								value={newCategoryName}
								onChange={(e) => setNewCategoryName(e.target.value)}
								placeholder="新しいカテゴリ名"
								className="flex-grow p-2 border rounded-l focus:ring-2 focus:ring-blue-500"
							/>
							<button
								type="button"
								onClick={handleAddCategory}
								className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r"
							>
								追加
							</button>
						</div>

						{parentCategories.length === 0 ? (
							<p className="text-gray-500 italic">カテゴリがまだありません。</p>
						) : (
							<ul className="space-y-2 mb-4">
								{parentCategories.map((category) => (
									<li
										key={category.id}
										className="border p-3 rounded flex justify-between items-center"
									>
										{editingCategoryId === category.id ? (
											<div className="flex flex-1">
												<input
													type="text"
													value={editingCategoryName}
													onChange={(e) =>
														setEditingCategoryName(e.target.value)
													}
													className="flex-grow p-1 border rounded-l"
												/>
												<button
													type="button"
													onClick={saveEditingCategory}
													className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-r"
												>
													保存
												</button>
											</div>
										) : (
											<span className="font-medium">
												{category.name} ({category.domains.length}ドメイン)
											</span>
										)}
										<div>
											{editingCategoryId !== category.id && (
												<button
													type="button"
													onClick={() => startEditingCategory(category)}
													className="text-blue-500 hover:text-blue-700 mr-3"
												>
													編集
												</button>
											)}
											<button
												type="button"
												onClick={() => handleDeleteCategory(category.id)}
												className="text-red-500 hover:text-red-700"
											>
												削除
											</button>
										</div>
									</li>
								))}
							</ul>
						)}
					</div>

					{/* ドメイン割り当て */}
					{savedTabs.length > 0 && (
						<div>
							<h3 className="text-lg font-medium text-gray-700 mb-3">
								ドメイン管理
							</h3>
							<div className="overflow-auto max-h-96">
								<table className="w-full text-left mb-4">
									<thead className="bg-gray-50">
										<tr>
											<th className="p-2">ドメイン</th>
											<th className="p-2">カテゴリ</th>
											<th className="p-2">アクション</th>
										</tr>
									</thead>
									<tbody>
										{savedTabs.map((tab) => {
											const currentCategory = parentCategories.find((cat) =>
												cat.domains.includes(tab.id),
											);

											return (
												<tr key={tab.id} className="border-b">
													<td className="p-2 max-w-[200px] truncate">
														{tab.domain}
													</td>
													<td className="p-2">
														<select
															value={currentCategory?.id || "none"}
															onChange={(e) =>
																assignDomainToCategory(tab.id, e.target.value)
															}
															className="w-full p-1 border rounded"
														>
															<option value="none">未分類</option>
															{parentCategories.map((category) => (
																<option key={category.id} value={category.id}>
																	{category.name}
																</option>
															))}
														</select>
													</td>
													<td className="p-2">
														<button
															type="button"
															onClick={() =>
																setActiveTabId(
																	activeTabId === tab.id ? null : tab.id,
																)
															}
															className="text-sm bg-blue-500 text-white px-2 py-1 rounded"
														>
															{activeTabId === tab.id
																? "閉じる"
																: "キーワード設定"}
														</button>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>

								{activeTabId && (
									<div className="bg-gray-50 p-4 rounded mb-4">
										<h4 className="text-md font-semibold mb-2">
											{savedTabs.find((tab) => tab.id === activeTabId)?.domain}{" "}
											の詳細設定
										</h4>
										<SubCategoryKeywordManager
											tabGroup={
												savedTabs.find((tab) => tab.id === activeTabId) || {
													id: activeTabId,
													domain: "",
													urls: [],
													subCategories: [],
													categoryKeywords: [],
												}
											}
										/>
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			)}

			<div className="flex justify-between items-center">
				<button
					type="button"
					onClick={handleSaveSettings}
					className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
				>
					設定を保存
				</button>

				{isSaved && (
					<span className="text-green-500 font-medium">
						設定が保存されました！
					</span>
				)}
			</div>
		</div>
	);
};

// Reactコンポーネントをレンダリング
document.addEventListener("DOMContentLoaded", () => {
	const appContainer = document.getElementById("options-app");
	if (!appContainer)
		throw new Error("Failed to find the options app container");

	const root = createRoot(appContainer);
	root.render(<OptionsPage />);
});
