import path from "path";
import { defineConfig } from "wxt";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
	manifest: {
		name: "Tab Manager",
		description: "Save, organize and restore tabs by domain and category",
		version: "1.0.0",
		permissions: ["tabs", "storage", "contextMenus", "notifications"],
		action: {
			default_title: "Tab Manager",
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
