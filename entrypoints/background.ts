import {
	getUserSettings,
	saveTabsWithAutoCategory,
	updateDomainCategorySettings,
	migrateParentCategoriesToDomainNames,
	getParentCategories,
	type SubCategoryKeyword,
} from "../utils/storage";
import { defineBackground } from "wxt/sandbox";

// 型定義
interface TabGroup {
	id: string;
	domain: string;
	parentCategoryId?: string;
	urls: Array<{
		url: string;
		title: string;
		subCategory?: string;
	}>;
	subCategories?: string[];
	categoryKeywords?: SubCategoryKeyword[];
}

interface ParentCategory {
	id: string;
	name: string;
	domains: string[];
	domainNames: string[];
}

export default defineBackground(() => {
	// ドラッグされたURL情報を一時保存するためのストア
	let draggedUrlInfo: {
		url: string;
		timestamp: number;
		processed: boolean; // 処理済みフラグを追加
	} | null = null;

	// バックグラウンド初期化時に一度だけマイグレーションを実行
	(async () => {
		try {
			console.log("バックグラウンド起動時のデータ構造チェックを開始...");

			// 既存のカテゴリを確認
			const categories = await getParentCategories();
			console.log("現在の親カテゴリ:", categories);

			// 強制的にマイグレーションを実行する
			console.log("親カテゴリのdomainNamesの強制マイグレーションを実行");
			await migrateParentCategoriesToDomainNames();

			// 移行後のデータを確認
			const updatedCategories = await getParentCategories();
			console.log("移行後の親カテゴリ:", updatedCategories);
		} catch (error) {
			console.error("バックグラウンド初期化エラー:", error);
		}
	})();

	// インストール時に実行する処理
	chrome.runtime.onInstalled.addListener(async () => {
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

		// データ構造の移行を実行
		try {
			console.log(
				"拡張機能インストール/更新時の親カテゴリデータ構造移行を開始...",
			);
			await migrateParentCategoriesToDomainNames();
			console.log("データ構造の移行が完了しました");
		} catch (error) {
			console.error("データ構造の移行に失敗しました:", error);
		}
	});

	// ブラウザアクション（拡張機能アイコン）クリック時の処理
	chrome.action.onClicked.addListener(async () => {
		console.log("拡張機能アイコンがクリックされました");

		try {
			const settings = await getUserSettings();
			// 現在のウィンドウのタブをすべて取得
			const allTabs = await chrome.tabs.query({ currentWindow: true });
			console.log(`取得したタブ: ${allTabs.length}個`);

			// 拡張機能のタブを除外
			const regularTabs = allTabs.filter((tab) => {
				if (!tab.url) return false;
				return !settings.excludePatterns.some((pattern) =>
					tab.url?.includes(pattern),
				);
			});
			console.log(`保存対象タブ: ${regularTabs.length}個`);

			// タブを保存して自動カテゴライズする
			await saveTabsWithAutoCategory(regularTabs);
			console.log("タブの保存と自動カテゴライズが完了しました");

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
					!settings.excludePatterns.some((pattern) =>
						tab.url?.includes(pattern),
					)
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

	// メッセージリスナーを追加
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		console.log("バックグラウンドがメッセージを受信:", message);

		// URLのドラッグ開始を処理
		if (message.action === "urlDragStarted") {
			console.log("ドラッグ開始を検知:", message.url);
			// ドラッグ情報を一時保存
			draggedUrlInfo = {
				url: message.url,
				timestamp: Date.now(),
				processed: false,
			};

			// 10秒後に情報を自動消去（タイムアウト）
			setTimeout(() => {
				if (
					draggedUrlInfo &&
					draggedUrlInfo.timestamp === Date.now() &&
					!draggedUrlInfo.processed
				) {
					console.log("ドラッグ情報のタイムアウト:", draggedUrlInfo.url);
					draggedUrlInfo = null;
				}
			}, 10000);

			sendResponse({ status: "ok" });
			return true;
		}

		// ドラッグ&ドロップ後のURL処理
		if (message.action === "urlDropped") {
			console.log("URLドロップを検知:", message.url);

			// fromExternal フラグが true の場合のみ処理（外部ドラッグの場合のみ）
			if (message.fromExternal === true) {
				getUserSettings().then((settings) => {
					if (settings.removeTabAfterOpen) {
						removeUrlFromStorage(message.url)
							.then(() => {
								console.log("外部ドロップ後にURLを削除しました:", message.url);
								sendResponse({ status: "removed" });
							})
							.catch((error) => {
								console.error("URL削除エラー:", error);
								sendResponse({ status: "error", error: error.toString() });
							});
					} else {
						console.log("設定により削除をスキップ");
						sendResponse({ status: "skipped" });
					}
				});
			} else {
				console.log("内部操作のため削除をスキップ");
				sendResponse({ status: "internal_operation" });
			}
			return true; // 非同期応答のため
		}

		// URLをストレージから削除
		if (message.action === "removeUrlFromStorage") {
			removeUrlFromStorage(message.url)
				.then(() => sendResponse({ status: "removed" }))
				.catch((error) => sendResponse({ status: "error", error }));
			return true; // 非同期応答のため
		}
	});

	// 新しいタブが作成されたときの処理
	chrome.tabs.onCreated.addListener(async (tab) => {
		console.log("新しいタブが作成されました:", tab.url);

		// ドラッグされた情報が存在するか確認
		if (draggedUrlInfo && !draggedUrlInfo.processed) {
			console.log("ドラッグ情報が存在します:", draggedUrlInfo.url);
			console.log("新しいタブのURL:", tab.url);

			// URLを正規化して比較
			const normalizedDraggedUrl = normalizeUrl(draggedUrlInfo.url);
			const normalizedTabUrl = normalizeUrl(tab.url || "");

			console.log("正規化されたドラッグURL:", normalizedDraggedUrl);
			console.log("正規化された新タブURL:", normalizedTabUrl);

			// URLが類似していれば処理
			if (
				normalizedTabUrl &&
				normalizedDraggedUrl &&
				(normalizedTabUrl === normalizedDraggedUrl ||
					normalizedTabUrl.includes(normalizedDraggedUrl) ||
					normalizedDraggedUrl.includes(normalizedTabUrl))
			) {
				console.log("URLが一致または類似しています");

				try {
					// 処理済みとマーク
					draggedUrlInfo.processed = true;

					const settings = await getUserSettings();
					if (settings.removeTabAfterOpen) {
						console.log("設定に基づきURLを削除します:", draggedUrlInfo.url);
						await removeUrlFromStorage(draggedUrlInfo.url);
					} else {
						console.log("設定により削除をスキップします");
					}
				} catch (error) {
					console.error("タブ作成後の処理でエラー:", error);
				} finally {
					// 処理完了後、ドラッグ情報をクリア
					draggedUrlInfo = null;
				}
			} else {
				console.log("URLが一致しません。削除をスキップします");
			}
		}
	});

	// URLを正規化する関数（比較のため）
	function normalizeUrl(url: string): string {
		try {
			// 不要なパラメータやフラグメントを取り除く
			return url.trim().toLowerCase().split("#")[0].split("?")[0];
		} catch {
			return url.toLowerCase();
		}
	}

	// URLをストレージから削除する関数（カテゴリ設定とマッピングを保持）
	// TabGroupが空になった時の処理関数
	async function handleTabGroupRemoval(groupId: string) {
		console.log(`空になったグループの処理を開始: ${groupId}`);
		await removeFromParentCategories(groupId);
		console.log(`グループ ${groupId} の処理が完了しました`);
	}

	async function removeUrlFromStorage(url: string) {
		try {
			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");

			// URLを含むグループを更新
			const updatedGroups = savedTabs
				.map((group: TabGroup) => {
					const updatedUrls = group.urls.filter((item) => item.url !== url);
					if (updatedUrls.length === 0) {
						// グループが空になる場合は専用の処理関数を呼び出し
						handleTabGroupRemoval(group.id);
						return null; // 空グループを削除
					}
					return { ...group, urls: updatedUrls };
				})
				.filter(Boolean);

			// 更新したグループをストレージに保存
			await chrome.storage.local.set({ savedTabs: updatedGroups });
			console.log(`ストレージからURL ${url} を削除しました`);
		} catch (error) {
			console.error("URLの削除中にエラーが発生しました:", error);
			throw error;
		}
	}

	// ドメインの設定を永続化する関数
	async function saveDomainSettings(
		domain: string,
		subCategories: string[],
		categoryKeywords: SubCategoryKeyword[],
	) {
		try {
			// domainが実際のURLドメインでなければ処理しない
			if (!domain.includes("://")) return;

			await updateDomainCategorySettings(
				domain,
				subCategories,
				categoryKeywords,
			);
			console.log(`ドメイン ${domain} のカテゴリ設定を永続化しました`);
		} catch (error) {
			console.error("カテゴリ設定の永続化エラー:", error);
		}
	}

	// グループを親カテゴリから削除する関数を更新
	async function removeFromParentCategories(groupId: string) {
		try {
			const { parentCategories = [] } =
				await chrome.storage.local.get("parentCategories");

			// 削除対象のドメイン名を取得
			const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
			const groupToRemove = savedTabs.find(
				(group: TabGroup) => group.id === groupId,
			);
			const domainName = groupToRemove?.domain;

			if (!groupToRemove || !domainName) {
				console.log(
					`削除対象のグループID ${groupId} が見つからないか、ドメイン名がありません`,
				);
				return;
			}

			console.log(
				`カテゴリから削除: グループID ${groupId}, ドメイン ${domainName}`,
			);

			// ドメイン名を保持したままドメインIDのみを削除
			const updatedCategories = parentCategories.map(
				(category: ParentCategory) => {
					// domainNamesは変更せず、domainsからIDのみを削除
					const updated = {
						...category,
						domains: category.domains.filter((id: string) => id !== groupId),
					};

					// ドメイン名がdomainNamesにあるか確認してログ出力
					if (category.domainNames && Array.isArray(category.domainNames)) {
						if (category.domainNames.includes(domainName)) {
							console.log(
								`ドメイン名 ${domainName} は ${category.name} のdomainNamesに保持されます`,
							);
						}
					}

					return updated;
				},
			);

			await chrome.storage.local.set({ parentCategories: updatedCategories });

			// 必要ならドメイン-カテゴリのマッピングを更新（削除しない）
			if (groupToRemove.parentCategoryId) {
				console.log(
					`ドメイン ${domainName} のマッピングを親カテゴリ ${groupToRemove.parentCategoryId} に保持します`,
				);
			}

			console.log(
				`カテゴリからグループID ${groupId} を削除しました（ドメイン名を保持）`,
			);
		} catch (error) {
			console.error("親カテゴリからの削除中にエラーが発生しました:", error);
		}
	}

	// コンテキストメニューの処理
	if (chrome.contextMenus?.onClicked) {
		chrome.contextMenus.onClicked.addListener(async (info, tab) => {
			if (info.menuItemId === "saveCurrentTab" && tab) {
				// 単一タブ保存時も自動カテゴライズ
				await saveTabsWithAutoCategory([tab]);
				chrome.notifications?.create({
					type: "basic",
					iconUrl: "/assets/react.svg",
					title: "タブ保存",
					message: "現在のタブが保存されました",
				});
			} else if (info.menuItemId === "saveAllTabs") {
				const tabs = await chrome.tabs.query({ currentWindow: true });
				// 複数タブ保存時も自動カテゴライズ
				await saveTabsWithAutoCategory(tabs);
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
