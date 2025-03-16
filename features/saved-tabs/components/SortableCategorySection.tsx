import { Button } from "@/components/ui/button";
import type { SortableCategorySectionProps } from "@/types/saved-tabs";
import { useSortable } from "@dnd-kit/sortable";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { GripVertical, ExternalLink } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { CategorySection } from "./TimeRemaining";

// 並び替え可能なカテゴリセクションコンポーネント
export const SortableCategorySection = ({
	id,
	handleOpenAllTabs,
	settings,
	...props
}: SortableCategorySectionProps & { settings: UserSettings }) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id,
		data: {
			type: "category-section",
		},
	});

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		zIndex: isDragging ? 100 : "auto",
		position: isDragging ? "relative" : "static",
		opacity: isDragging ? 0.8 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={
				isDragging
					? "category-section mb-1 bg-muted rounded-md shadow-lg"
					: "category-section mb-1"
			}
		>
			<div className="category-header mb-0.5 pb-0.5 border-b border-border flex items-center justify-between">
				{/* ドラッグハンドル部分 */}
				<div
					className={`flex items-center flex-grow ${isDragging ? "cursor-grabbing" : "cursor-grab hover:cursor-grab active:cursor-grabbing"}`}
					{...attributes}
					{...listeners}
				>
					<div className="mr-2 text-muted-foreground/60">
						<GripVertical size={16} aria-hidden="true" />
					</div>
					<h3 className="font-medium text-foreground">
						{props.categoryName === "__uncategorized"
							? "未分類"
							: props.categoryName}{" "}
						<span className="text-sm text-muted-foreground">
							({props.urls.length})
						</span>
					</h3>
				</div>

				{/* すべて開くボタン - 独立した要素としてドラッグハンドラの影響を受けないようにする */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="secondary"
							size="sm"
							onClick={(e) => {
								e.stopPropagation(); // ドラッグイベントの伝播を防止
								handleOpenAllTabs(props.urls);
							}}
							className="flex items-center gap-1 z-20 pointer-events-auto cursor-pointer"
							title={`${props.categoryName === "__uncategorized" ? "未分類" : props.categoryName}のタブをすべて開く`}
							style={{ position: "relative" }} // ボタンを確実に上に表示
						>
							<ExternalLink size={14} />
							<span className="lg:inline hidden">すべて開く</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top" className="lg:hidden block">
						すべてのタブを開く
					</TooltipContent>
				</Tooltip>
			</div>

			<CategorySection {...props} settings={settings} />
		</div>
	);
};
