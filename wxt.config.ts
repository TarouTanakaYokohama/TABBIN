import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

export default defineConfig({
	manifest: {
		name: "TABBIN",
		description:
			"TABBIN(タビン)はブラウザのタブを整理・分類する拡張機能です。散らかりがちなタブをスマートに管理し、快適なブラウジング体験を実現します。",
		version: "1.1.5",
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
