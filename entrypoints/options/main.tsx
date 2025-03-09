import "@/assets/tailwind.css";
import { useEffect, useState, useRef } from "react";
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
	const [newSubCategory, setNewSubCategory] = useState("");

	// タブグループを更新するヘルパー関数
	const updateTabGroup = async (updatedTabGroup: TabGroup) => {
		try {
			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
			const updatedTabs = savedTabs.map((tab: TabGroup) =>
				tab.id === updatedTabGroup.id ? updatedTabGroup : tab,
			);
			await chrome.storage.local.set({ savedTabs: updatedTabs });
			return true;
		} catch (error) {
			console.error("タブグループ更新エラー:", error);
			return false;
		}
	};

	const handleCategorySelect = (categoryName: string) => {
		setActiveCategory(categoryName);
		const categoryKeywords = tabGroup.categoryKeywords?.find(
			(ck) => ck.categoryName === categoryName,
		);
		setKeywords(categoryKeywords?.keywords || []);
	};

	// キーワード追加関数に重複チェックを追加
	const handleAddKeyword = () => {
		if (newKeyword.trim() && activeCategory) {
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
			setCategoryKeywords(tabGroup.id, activeCategory, updatedKeywords)
				.then(() => setNewKeyword(""))
				.catch((err) => console.error("キーワード保存エラー:", err));
		}
	};

	// キーワードを削除した時に自動保存する処理を修正
	const handleRemoveKeyword = async (keywordToRemove: string) => {
		if (activeCategory) {
			try {
				// キーワードをフィルタリング
				const updatedKeywords = keywords.filter((k) => k !== keywordToRemove);

				// UI状態を先に更新
				setKeywords(updatedKeywords);

				// ストレージに保存
				await setCategoryKeywords(tabGroup.id, activeCategory, updatedKeywords);

				console.log(`キーワード "${keywordToRemove}" を削除しました`);
			} catch (error) {
				console.error("キーワード削除エラー:", error);

				// エラー時はキーワードリストを再取得して状態を元に戻す
				const categoryKeywords = tabGroup.categoryKeywords?.find(
					(ck) => ck.categoryName === activeCategory,
				);
				setKeywords(categoryKeywords?.keywords || []);

				// エラーを表示
				alert("キーワードの削除に失敗しました。再度お試しください。");
			}
		}
	};

	// 新しい子カテゴリを追加
	const handleAddSubCategory = async () => {
		if (newSubCategory.trim()) {
			const categoryName = newSubCategory.trim();

			// 既存の子カテゴリと重複していないか確認
			if (tabGroup.subCategories?.includes(categoryName)) {
				alert("この子カテゴリは既に存在します");
				return;
			}

			// 子カテゴリを追加
			const updatedTabGroup = {
				...tabGroup,
				subCategories: [...(tabGroup.subCategories || []), categoryName],
				categoryKeywords: [
					...(tabGroup.categoryKeywords || []),
					{ categoryName, keywords: [] },
				],
			};

			const success = await updateTabGroup(updatedTabGroup);
			if (success) {
				setNewSubCategory("");
				setActiveCategory(categoryName); // 新しいカテゴリを選択状態に
				setKeywords([]);
			}
		}
	};

	// 子カテゴリ削除関数を完全に書き換え - saved-tabs/main.tsxのパターンに基づく
	const handleRemoveSubCategory = async (categoryToRemove: string) => {
		console.log(`子カテゴリの削除を開始: "${categoryToRemove}"`);

		try {
			// 確認ダイアログを一時的にスキップ (問題特定のため)
			// if (confirm(`子カテゴリ "${categoryToRemove}" を削除してもよろしいですか？`)) {

			// 選択中のカテゴリを削除する場合は選択を解除
			if (activeCategory === categoryToRemove) {
				setActiveCategory(null);
				setKeywords([]);
			}

			// saved-tabs/main.tsxのパターンに基づく直接的な実装
			console.log("削除するカテゴリ:", categoryToRemove);
			console.log("タブグループID:", tabGroup.id);

			// タブの情報を取得
			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
			console.log("取得したsavedTabs:", savedTabs);

			// 対象のタブグループを探す
			const groupToUpdate = savedTabs.find(
				(g: TabGroup) => g.id === tabGroup.id,
			);
			console.log("更新対象のグループ:", groupToUpdate);

			if (!groupToUpdate) {
				console.error("タブグループが見つかりません");
				return;
			}

			// 子カテゴリリストと関連キーワードからカテゴリを削除
			const updatedSubCategories = (groupToUpdate.subCategories || []).filter(
				(cat: string) => cat !== categoryToRemove,
			);

			const updatedCategoryKeywords = (
				groupToUpdate.categoryKeywords || []
			).filter(
				(ck: { categoryName: string }) => ck.categoryName !== categoryToRemove,
			);

			console.log("更新後のサブカテゴリ:", updatedSubCategories);
			console.log("更新後のキーワード設定:", updatedCategoryKeywords);

			// グループを更新
			const updatedGroup = {
				...groupToUpdate,
				subCategories: updatedSubCategories,
				categoryKeywords: updatedCategoryKeywords,
			};

			// 保存
			const updatedTabs = savedTabs.map((g: TabGroup) =>
				g.id === tabGroup.id ? updatedGroup : g,
			);

			// ストレージに保存
			await chrome.storage.local.set({ savedTabs: updatedTabs });
			console.log("ストレージに保存完了");

			alert(`カテゴリ "${categoryToRemove}" を削除しました`);
			// }
		} catch (error) {
			console.error("子カテゴリ削除エラー:", error);
			alert(`カテゴリの削除中にエラーが発生しました: ${error}`);
		}
	};

	if (!tabGroup.subCategories || tabGroup.subCategories.length === 0) {
		// 子カテゴリがない場合も追加フォームを表示（ボタン削除）
		return (
			<div className="mt-4 border-t pt-4">
				<p className="text-gray-500 mb-3">
					このドメインには子カテゴリがありません。
				</p>
				<div className="mb-4">
					<label
						htmlFor="new-subcategory"
						className="block text-sm font-medium text-gray-700 mb-1"
					>
						新しい子カテゴリを追加
					</label>
					<input
						id="new-subcategory"
						type="text"
						value={newSubCategory}
						onChange={(e) => setNewSubCategory(e.target.value)}
						onBlur={handleAddSubCategory}
						placeholder="子カテゴリ名（入力後にフォーカスを外すと保存）"
						className="w-full p-2 border rounded"
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								handleAddSubCategory();
							}
						}}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="mt-4 border-t pt-4">
			<h4 className="text-md font-medium mb-2">子カテゴリキーワード管理</h4>

			{/* 新しい子カテゴリの追加フォーム（ボタン削除） */}
			<div className="mb-4">
				<label
					htmlFor="new-subcategory"
					className="block text-sm font-medium text-gray-700 mb-1"
				>
					新しい子カテゴリを追加
				</label>
				<input
					id="new-subcategory"
					type="text"
					value={newSubCategory}
					onChange={(e) => setNewSubCategory(e.target.value)}
					onBlur={handleAddSubCategory}
					placeholder="子カテゴリ名（入力後にフォーカスを外すと保存）"
					className="w-full p-2 border rounded"
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							handleAddSubCategory();
						}
					}}
				/>
			</div>

			{/* 子カテゴリボタン一覧 - 削除ボタンのクリックイベントを確実に設定 */}
			<div className="flex flex-wrap gap-2 mb-3">
				{tabGroup.subCategories.map((category) => (
					<div key={category} className="flex items-center">
						<button
							type="button"
							onClick={() => handleCategorySelect(category)}
							className={`px-2 py-1 text-sm rounded-l ${
								activeCategory === category
									? "bg-blue-500 text-white"
									: "bg-gray-100 hover:bg-gray-200"
							}`}
						>
							{category}
						</button>
						{/* 削除ボタンの onClick イベントを修正 */}
						<button
							type="button"
							onClick={() => handleRemoveSubCategory(category)}
							className="bg-red-500 text-white px-2 py-1 text-sm rounded-r hover:bg-red-600"
							title="カテゴリを削除"
						>
							×
						</button>
					</div>
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
						{/* キーワード追加フォーム（ボタン削除） */}
						<input
							id={`keyword-input-${activeCategory}`}
							type="text"
							value={newKeyword}
							onChange={(e) => setNewKeyword(e.target.value)}
							placeholder="新しいキーワードを入力（入力後にフォーカスを外すと保存）"
							className="w-full p-2 border rounded"
							onBlur={handleAddKeyword}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleAddKeyword();
								}
							}}
						/>
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
	const [categoryError, setCategoryError] = useState<string | null>(null); // エラーメッセージ用の状態変数
	const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
		null,
	);
	const [editingCategoryName, setEditingCategoryName] = useState("");
	const [activeTabId, setActiveTabId] = useState<string | null>(null);
	const editInputRef = useRef<HTMLInputElement>(null);

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
		// 変更後に自動保存
		setTimeout(handleSaveSettings, 0);
	};

	const handleToggleEnableCategories = (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		setSettings((prev) => ({
			...prev,
			enableCategories: e.target.checked,
		}));
		// 変更後に自動保存
		setTimeout(handleSaveSettings, 0);
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

	// テキストエリアからフォーカスが外れたときに保存
	const handleExcludePatternsBlur = () => {
		handleSaveSettings();
	};

	// 新しいカテゴリを追加
	const handleAddCategory = async () => {
		if (newCategoryName.trim()) {
			// 重複をチェック
			const isDuplicate = parentCategories.some(
				(cat) =>
					cat.name.toLowerCase() === newCategoryName.trim().toLowerCase(),
			);

			if (isDuplicate) {
				setCategoryError("同じ名前のカテゴリがすでに存在します。");
				setTimeout(() => setCategoryError(null), 3000); // 3秒後にエラーメッセージを消す
				return;
			}

			try {
				await createParentCategory(newCategoryName.trim());
				setNewCategoryName("");
				setCategoryError(null);
			} catch (error) {
				console.error("カテゴリ追加エラー:", error);
				setCategoryError("カテゴリの追加に失敗しました。");
				setTimeout(() => setCategoryError(null), 3000);
			}
		}
	};

	// Enterキーを押したときのハンドラ
	const handleKeyDown = (
		e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		// テキストエリアの場合は元の処理を維持
		if (e.currentTarget.tagName.toLowerCase() === "textarea") {
			if (e.key === "Enter") {
				e.stopPropagation();
			}
		}
		// カテゴリ入力の場合
		else if (e.key === "Enter") {
			e.preventDefault();
			handleAddCategory();
		}
	};

	// カテゴリ名の編集を開始
	const startEditingCategory = (category: ParentCategory) => {
		setEditingCategoryId(category.id);
		setEditingCategoryName(category.name);

		// 編集モードに入った直後に実行される
		setTimeout(() => {
			editInputRef.current?.focus();
		}, 0);
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

				// 保存成功通知
				setIsSaved(true);
				setTimeout(() => setIsSaved(false), 2000);
			} catch (error) {
				console.error("カテゴリ編集エラー:", error);
				alert("カテゴリの保存に失敗しました");
			}
		} else {
			// 空の場合は編集をキャンセル
			setEditingCategoryId(null);
		}
	};

	// 直接カテゴリを削除するための単純化メソッド
	const deleteCategory = async (categoryId: string) => {
		try {
			console.log(`カテゴリ削除実行: ${categoryId}`);

			// 更新前のカテゴリ数をログ
			console.log(`削除前のカテゴリ数: ${parentCategories.length}`);

			// フィルタリングで指定IDのカテゴリを除外
			const filteredCategories = parentCategories.filter(
				(cat) => cat.id !== categoryId,
			);

			console.log(`削除後のカテゴリ数: ${filteredCategories.length}`);
			console.log("削除するカテゴリID:", categoryId);
			console.log("フィルタリング後のカテゴリ:", filteredCategories);

			// ストレージに保存
			await chrome.storage.local.set({ parentCategories: filteredCategories });

			// 関連するタブも更新
			const updatedTabs = savedTabs.map((tab) =>
				tab.parentCategoryId === categoryId
					? { ...tab, parentCategoryId: undefined }
					: tab,
			);
			await chrome.storage.local.set({ savedTabs: updatedTabs });

			// ローカル状態を更新
			setParentCategories(filteredCategories);
			setSavedTabs(updatedTabs);

			// 保存成功通知
			setIsSaved(true);
			setTimeout(() => setIsSaved(false), 2000);
		} catch (error) {
			console.error("カテゴリ削除エラー:", error);
			alert("カテゴリの削除に失敗しました。");
		}
	};

	// カテゴリを削除
	const handleDeleteCategory = async (
		categoryId: string,
		skipConfirmation = false,
	) => {
		console.log(`親カテゴリ削除開始: ID=${categoryId}`);

		try {
			// イベント伝播を防止するため、即時関数を使用
			const proceedWithDeletion =
				skipConfirmation ||
				window.confirm("このカテゴリを削除してもよろしいですか？");
			console.log("確認ダイアログの結果:", proceedWithDeletion);

			if (proceedWithDeletion) {
				// 削除前に現在のカテゴリをログ
				console.log("削除前のカテゴリリスト:", parentCategories);

				// 指定されたIDを持つカテゴリ以外をフィルタリング
				const updatedCategories = parentCategories.filter(
					(cat) => cat.id !== categoryId,
				);
				console.log("削除後のカテゴリリスト:", updatedCategories);

				// 更新したカテゴリリストを保存
				await saveParentCategories(updatedCategories);
				console.log("カテゴリリストの保存完了");

				// 関連するドメインの親カテゴリIDも削除
				const updatedTabs = savedTabs.map((tab) =>
					tab.parentCategoryId === categoryId
						? { ...tab, parentCategoryId: undefined }
						: tab,
				);
				await chrome.storage.local.set({ savedTabs: updatedTabs });
				console.log("関連ドメインの親カテゴリ参照を削除しました");

				// 状態を直接更新して即時反映
				setParentCategories(updatedCategories);
				setSavedTabs(updatedTabs);

				// 削除成功通知
				setIsSaved(true);
				setTimeout(() => setIsSaved(false), 2000);
			} else {
				console.log("カテゴリ削除がキャンセルされました");
			}
		} catch (error) {
			console.error("カテゴリ削除エラー:", error);
			alert("カテゴリの削除中にエラーが発生しました。");
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
			alert("ドメインの割り当てに失敗しました。");
		}
	};

	// 単純なカテゴリ削除関数 - 確認ダイアログなし
	const forceDeleteCategory = async (categoryId: string) => {
		try {
			console.log("強制削除を実行:", categoryId);

			// chrome.storage.localから直接取得
			const { parentCategories: storedCategories = [] } =
				await chrome.storage.local.get("parentCategories");

			// カテゴリを削除
			const newCategories = storedCategories.filter(
				(cat: ParentCategory) => cat.id !== categoryId,
			);

			console.log("削除前カテゴリ数:", storedCategories.length);
			console.log("削除後カテゴリ数:", newCategories.length);

			// ストレージに直接保存
			await chrome.storage.local.set({ parentCategories: newCategories });

			// タブの参照も更新
			const { savedTabs: storedTabs = [] } =
				await chrome.storage.local.get("savedTabs");
			const newTabs = storedTabs.map((tab: TabGroup) =>
				tab.parentCategoryId === categoryId
					? { ...tab, parentCategoryId: undefined }
					: tab,
			);

			await chrome.storage.local.set({ savedTabs: newTabs });

			// React状態を更新
			setParentCategories(newCategories);
			setSavedTabs(newTabs);

			// 成功メッセージ
			setIsSaved(true);
			setTimeout(() => setIsSaved(false), 2000);

			return true;
		} catch (error) {
			console.error("強制削除エラー:", error);
			return false;
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
						onBlur={handleExcludePatternsBlur}
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
						<div className="mb-4">
							<input
								type="text"
								value={newCategoryName}
								onChange={(e) => setNewCategoryName(e.target.value)}
								onBlur={handleAddCategory}
								onKeyDown={handleKeyDown}
								placeholder="新しいカテゴリ名"
								className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
							/>
						</div>
						{categoryError && (
							<p className="text-red-500 text-sm mb-3">{categoryError}</p>
						)}

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
													ref={editInputRef}
													value={editingCategoryName}
													onChange={(e) =>
														setEditingCategoryName(e.target.value)
													}
													onBlur={saveEditingCategory}
													onKeyDown={(e) => {
														if (e.key === "Enter") {
															e.preventDefault();
															saveEditingCategory();
														} else if (e.key === "Escape") {
															setEditingCategoryId(null);
														}
													}}
													className="flex-grow p-1 border rounded w-full"
												/>
											</div>
										) : (
											<button
												type="button"
												className="font-medium cursor-pointer hover:text-blue-600 hover:underline flex-1 text-left bg-transparent border-none p-0"
												onClick={() => startEditingCategory(category)}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === "Space") {
														e.preventDefault();
														startEditingCategory(category);
													}
												}}
												title="クリックして編集"
												aria-label={`${category.name}を編集 (${category.domains.length}ドメイン)`}
											>
												{category.name} ({category.domains.length}ドメイン)
											</button>
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
											{/* 削除ボタン - 直接deleteCategory関数を呼び出す */}
											<button
												type="button"
												onClick={(e) => {
													e.preventDefault();
													e.stopPropagation();
													console.log("削除ボタンがクリックされました");
													forceDeleteCategory(category.id);
												}}
												className="text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded"
											>
												強制削除
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

			{/* 保存ボタンは削除し、保存完了メッセージのみ表示 */}

			{isSaved && (
				<div className="text-center mb-4">
					<span className="text-green-500 font-medium">
						設定が保存されました！
					</span>
				</div>
			)}
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
