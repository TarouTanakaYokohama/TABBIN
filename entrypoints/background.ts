import { saveTabs } from "../utils/storage";
import { defineBackground } from "wxt/sandbox";

export default defineBackground(() => {
	// インストール時にコンテキストメニューを作成
	chrome.runtime.onInstalled.addListener(() => {
		// コンテキストメニューを作成
		chrome.contextMenus?.create({
			id: "saveCurrentTab",
			title: "現在のタブを保存",
			contexts: ["page"],
		});

		chrome.contextMenus?.create({
			id: "saveAllTabs",
			title: "すべてのタブを保存",
			contexts: ["page"],
		});
	});

	// ブラウザアクション（拡張機能アイコン）クリック時の処理
	chrome.action.onClicked.addListener(async () => {
		console.log("拡張機能アイコンがクリックされました");

		try {
			// 現在のウィンドウのタブをすべて取得
			const allTabs = await chrome.tabs.query({ currentWindow: true });
			console.log(`取得したタブ: ${allTabs.length}個`);

			// 拡張機能のタブを除外
			const regularTabs = allTabs.filter(
				(tab) => tab.url && !tab.url.startsWith("chrome-extension://"),
			);
			console.log(`保存対象タブ: ${regularTabs.length}個`);

			// タブを保存
			await saveTabs(regularTabs);
			console.log("タブの保存が完了しました");

			// 保存完了通知を表示
			chrome.notifications?.create({
				type: "basic",
				iconUrl: "/assets/react.svg",
				title: "タブ保存",
				message: `${regularTabs.length}個のタブが保存されました。タブを閉じます。`,
			});

			// 保存されたタブを表示するページを開く
			const savedTabsUrl = chrome.runtime.getURL("saved-tabs.html");
			console.log("開くURL:", savedTabsUrl);

			// 既存のsaved-tabsページを探す
			const existingTabs = await chrome.tabs.query({ url: savedTabsUrl });
			let savedTabsTabId: number | undefined;

			if (existingTabs.length > 0) {
				console.log("既存のタブを表示します:", existingTabs[0].id);
				savedTabsTabId = existingTabs[0].id;
				if (savedTabsTabId)
					await chrome.tabs.update(savedTabsTabId, { active: true });
			} else {
				console.log("新しいタブを作成します");
				const newTab = await chrome.tabs.create({ url: savedTabsUrl });
				savedTabsTabId = newTab.id;
				if (savedTabsTabId) {
					console.log("新しいタブをピン留めします:", savedTabsTabId);
					await chrome.tabs.update(savedTabsTabId, { pinned: true });
				}
			}

			// 閉じるタブを収集 (chrome-extension:// と saved-tabs.html を除く)
			const tabIdsToClose: number[] = [];

			for (const tab of allTabs) {
				// 次の条件を満たすタブのみ閉じる:
				// 1. タブIDが存在する
				// 2. saved-tabsページではない
				// 3. chrome-extensionではない
				if (
					tab.id &&
					tab.id !== savedTabsTabId &&
					tab.url &&
					!tab.url.startsWith("chrome-extension://")
				) {
					tabIdsToClose.push(tab.id);
				}
			}

			// タブを閉じる
			if (tabIdsToClose.length > 0) {
				console.log(
					`${tabIdsToClose.length}個のタブを閉じます:`,
					tabIdsToClose,
				);

				// タブを一つずつ閉じるためのループ（エラーハンドリングのため）
				for (const tabId of tabIdsToClose) {
					try {
						await chrome.tabs.remove(tabId);
						console.log(`タブID ${tabId} を閉じました`);
					} catch (error) {
						console.error(
							`タブID ${tabId} を閉じる際にエラーが発生しました:`,
							error,
						);
					}
				}

				console.log("すべてのタブを閉じました");
			} else {
				console.log("閉じるべきタブはありません");
			}
		} catch (error) {
			console.error("エラーが発生しました:", error);
		}
	});

	// コンテキストメニューの処理
	if (chrome.contextMenus?.onClicked) {
		chrome.contextMenus.onClicked.addListener(async (info, tab) => {
			if (info.menuItemId === "saveCurrentTab" && tab) {
				await saveTabs([tab]);
				chrome.notifications?.create({
					type: "basic",
					iconUrl: "/assets/react.svg",
					title: "タブ保存",
					message: "現在のタブが保存されました",
				});
			} else if (info.menuItemId === "saveAllTabs") {
				const tabs = await chrome.tabs.query({ currentWindow: true });
				await saveTabs(tabs);
				chrome.notifications?.create({
					type: "basic",
					iconUrl: "/assets/react.svg",
					title: "タブ保存",
					message: `${tabs.length}個のタブが保存されました`,
				});
			}
		});
	}
});
