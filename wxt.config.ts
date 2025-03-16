import { defineConfig } from "wxt";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	manifest: {
		name: "TABBIN",
		description:
			"TABBIN(タビン)はブラウザのタブを整理・分類する拡張機能です。散らかりがちなタブをスマートに管理し、快適なブラウジング体験を実現します。",
		version: "1.0.0",
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
