import { saveTabs } from "../utils/storage";

export default defineBackground(() => {
	chrome.action.onClicked.addListener(async (tab) => {
		const tabs = await chrome.tabs.query({ currentWindow: true });
		await saveTabs(tabs);

		// 保存された内容を確認
		const { savedTabs } = await chrome.storage.local.get("savedTabs");
		console.log("保存されたタブ:", savedTabs);

		// タブIDの配列を作成して一括で閉じる
		const tabIds = tabs
			.map((tab) => tab.id)
			.filter((id): id is number => id !== undefined);
		await chrome.tabs.remove(tabIds);
	});
});
