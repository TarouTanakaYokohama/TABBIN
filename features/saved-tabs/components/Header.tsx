import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Settings } from "lucide-react";
import { useState } from "react";
import type { TabGroup } from "../../../utils/storage";
import { CategoryModal } from "./CategoryModal";

type HeaderProps = {
	tabGroups: TabGroup[];
};

export const Header = ({ tabGroups }: HeaderProps) => {
	const [isModalOpen, setIsModalOpen] = useState(false);

	return (
		<div className="flex justify-between items-center mb-4">
			<h1 className="text-3xl font-bold text-foreground">TABBIN</h1>
			<div className="flex items-center gap-1">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsModalOpen(true)}
							className="flex items-center gap-2 cursor-pointer"
							title="親カテゴリ作成"
						>
							<Plus size={16} />
							<span className="lg:inline hidden">カテゴリ作成</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top" className="lg:hidden block">
						親カテゴリ作成
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							onClick={() => chrome.runtime.openOptionsPage()}
							className="flex items-center gap-2 cursor-pointer"
							title="設定"
						>
							<Settings size={16} />
							<span className="lg:inline hidden">設定</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top" className="lg:hidden block">
						設定
					</TooltipContent>
				</Tooltip>
				<div className="text-sm text-muted-foreground space-x-4">
					<p>
						タブ:
						{tabGroups.reduce((sum, group) => sum + group.urls.length, 0)}
					</p>
					<p>ドメイン: {tabGroups.length}</p>
				</div>
			</div>

			{isModalOpen && (
				<CategoryModal
					onClose={() => setIsModalOpen(false)}
					tabGroups={tabGroups}
				/>
			)}
		</div>
	);
};
