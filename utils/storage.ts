import { v4 as uuidv4 } from "uuid";

export interface TabGroup {
	id: string;
	domain: string;
	urls: {
		url: string;
		title: string;
	}[];
}

export async function saveTabs(tabs: chrome.tabs.Tab[]) {
	const groupedTabs = new Map<string, TabGroup>();

	// 既存のタブグループを取得
	const { savedTabs = [] } = await chrome.storage.local.get("savedTabs");
	for (const group of savedTabs) {
		groupedTabs.set(group.domain, group);
	}

	// 新しいタブを適切なグループに振り分け
	for (const tab of tabs) {
		if (!tab.url) continue;

		// 拡張機能のURLは除外
		if (tab.url.startsWith("chrome-extension://")) continue;

		try {
			const url = new URL(tab.url);
			const domain = `${url.protocol}//${url.hostname}`;

			if (!groupedTabs.has(domain)) {
				groupedTabs.set(domain, {
					id: uuidv4(),
					domain,
					urls: [],
				});
			}

			const group = groupedTabs.get(domain);
			if (!group) continue;

			// URLが既に存在するかチェック
			const urlExists = group.urls.some(
				(existingUrl) => existingUrl.url === tab.url,
			);
			if (!urlExists) {
				group.urls.push({
					url: tab.url,
					title: tab.title || "",
				});
			}
		} catch (error) {
			console.error(`Invalid URL: ${tab.url}`, error);
		}
	}

	// ストレージに保存
	await chrome.storage.local.set({
		savedTabs: Array.from(groupedTabs.values()),
	});
}
