import "@/assets/tailwind.css";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getUserSettings, saveUserSettings } from "../../utils/storage";
import type { UserSettings } from "../../utils/storage";
import { defaultSettings } from "../../utils/storage";

const OptionsPage = () => {
	const [settings, setSettings] = useState<UserSettings>(defaultSettings);
	const [isSaved, setIsSaved] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const loadSettings = async () => {
			try {
				const userSettings = await getUserSettings();
				setSettings(userSettings);
			} catch (error) {
				console.error("設定の読み込みエラー:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadSettings();
	}, []);

	const handleSaveSettings = async () => {
		try {
			await saveUserSettings(settings);
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
			</div>

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
