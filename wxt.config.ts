import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

export default defineConfig({
	manifest: {
		name: "TABBIN",
		description:
			"ブラウザのタブを整理・分類する拡張機能です。散らかりがちなタブを管理できます。",
		version: "1.1.13",
		permissions: ["alarms", "tabs", "storage", "contextMenus", "notifications"],
		action: {
			default_title: "TABBIN",
		},
		options_ui: {
			page: "options.html",
			open_in_tab: true,
		},
	},
	vite: () => ({
		plugins: [react(), tailwindcss()],
	}),
});
