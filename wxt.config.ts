import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

export default defineConfig({
	manifest: {
		name: "TABBIN",
		description:
			"ブラウザのタブを整理・分類する拡張機能です。散らかりがちなタブを管理できます。",
		version: "1.2.1",
		host_permissions: [
			"http://localhost:11434/*",
			"http://127.0.0.1:11434/*",
		],
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
