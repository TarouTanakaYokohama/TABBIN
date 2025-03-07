import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
	extensionApi: "chrome",
	modules: ["@wxt-dev/module-react"],
	manifest: {
		name: "Tab Manager",
		description: "Save, organize and restore tabs by domain and category",
		version: "1.0.0",
		permissions: ["tabs", "storage"],
		action: {
			default_title: "Tab Manager",
		},
	},
});
