import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import type { CategoryGroupProps } from "@/types/saved-tabs";
import { CategoryManagementModal } from "../components/CategoryManagementModal";

interface TabGroup {
	id: string;
	domain: string;
	urls: Array<{ url: string; title: string; subCategory?: string }>;
	subCategories?: string[];
}

interface ParentCategory {
	id: string;
	name: string;
	domains: string[];
	domainNames: string[];
}
import {
	useSensors,
	useSensor,
	PointerSensor,
	KeyboardSensor,
	DndContext,
	closestCenter,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
	useSortable,
	sortableKeyboardCoordinates,
	arrayMove,
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVertical, ExternalLink, Edit } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SortableDomainCard } from "./SortableDomainCard";
import { CSS } from "@dnd-kit/utilities";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

// カテゴリグループコンポーネント
export const CategoryGroup = ({
	category,
	domains,
	handleOpenAllTabs,
	handleDeleteGroup,
	handleDeleteUrl,
	handleOpenTab,
	handleUpdateUrls,
	handleUpdateDomainsOrder,
	handleMoveDomainToCategory,
	handleDeleteCategory,
	settings,
}: CategoryGroupProps) => {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [isDraggingOver, setIsDraggingOver] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	// ドメインの状態を追加
	const [localDomains, setLocalDomains] = useState<TabGroup[]>(domains);

	// カテゴリ名が更新されたときの処理
	const handleCategoryUpdate = async (categoryId: string, newName: string) => {
		try {
			// 詳細な開始ログ
			console.log("CategoryGroup - handleCategoryUpdate開始:", {
				categoryId,
				newName,
				currentCategory: category,
				isValidCategory: !!category && !!category.id,
				currentDomains: localDomains,
			});

			// ローカルストレージから現在のカテゴリグループを取得
			console.log("CategoryGroup - ストレージからカテゴリグループを取得中...");
			const result = await chrome.storage.local.get(["parentCategories"]);
			const categoryGroups = result.parentCategories || [];
			console.log("CategoryGroup - 現在のカテゴリグループ:", categoryGroups);

			// 対象のカテゴリが存在するか確認
			const existingCategory = categoryGroups.find(
				(cat: ParentCategory) => cat.id === categoryId,
			);
			console.log("CategoryGroup - 既存のカテゴリ:", existingCategory);

			if (!existingCategory) {
				console.log("CategoryGroup - カテゴリが見つからないため新規作成");
				categoryGroups.push({
					id: categoryId,
					name: newName,
					domains: [],
					domainNames: [],
				});
			}

			// カテゴリ名を更新
			console.log("CategoryGroup - カテゴリ名の更新処理開始");
			const updatedGroups = categoryGroups.map((cat: ParentCategory) => {
				if (cat.id === categoryId) {
					console.log("CategoryGroup - カテゴリを更新:", {
						oldName: cat.name,
						newName,
						currentCategory: cat,
					});
					return {
						...cat,
						name: newName,
						domainNames: [...(cat.domainNames || [])], // 既存のドメイン名を保持
					};
				}
				return cat;
			});

			console.log("CategoryGroup - 更新内容を確認:", {
				before: categoryGroups,
				after: updatedGroups,
				targetId: categoryId,
			});

			// ストレージに保存して確認
			console.log("CategoryGroup - ストレージに保存開始");
			await chrome.storage.local.set({ parentCategories: updatedGroups });

			// 保存結果を確認して再試行
			let retryCount = 0;
			const maxRetries = 3;

			while (retryCount < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, 500));
				const checkResult = await chrome.storage.local.get("parentCategories");
				const savedCategory = checkResult.parentCategories?.find(
					(cat: ParentCategory) => cat.id === categoryId,
				);

				if (savedCategory && savedCategory.name === newName) {
					console.log("CategoryGroup - 保存の確認に成功:", savedCategory);
					break;
				}

				console.log(
					`CategoryGroup - 保存の確認に失敗 (試行 ${retryCount + 1}/${maxRetries})`,
				);
				await chrome.storage.local.set({ parentCategories: updatedGroups });
				retryCount++;
			}

			// 保存結果を確認
			const savedResult = await chrome.storage.local.get(["parentCategories"]);
			const savedCategory = savedResult.parentCategories?.find(
				(cat: ParentCategory) => cat.id === categoryId,
			);

			if (!savedCategory || savedCategory.name !== newName) {
				console.error("CategoryGroup - 保存の検証に失敗:", {
					savedCategory,
					expectedName: newName,
				});
				throw new Error("カテゴリの更新が正しく保存されませんでした");
			}

			console.log("CategoryGroup - ストレージ保存完了", {
				savedCategory,
				allCategories: savedResult.parentCategories,
			});

			// 保存が完了したことを通知
			await new Promise((resolve) => setTimeout(resolve, 500)); // 更新が反映されるまで待機

			// 更新の反映を待機してから処理を完了
			console.log("CategoryGroup - 更新完了を待機中...");
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// 最終確認
			const finalCheck = await chrome.storage.local.get("parentCategories");
			const finalCategory = finalCheck.parentCategories?.find(
				(cat: ParentCategory) => cat.id === categoryId,
			);

			if (!finalCategory || finalCategory.name !== newName) {
				console.error("CategoryGroup - 最終確認で更新が反映されていません:", {
					expectedName: newName,
					actualName: finalCategory?.name,
				});
				throw new Error("カテゴリ名の更新が反映されていません");
			}

			console.log("CategoryGroup - カテゴリ更新が完了しました:", finalCategory);
		} catch (error) {
			console.error("CategoryGroup - カテゴリ名の更新に失敗:", {
				error,
				categoryId,
				newName,
				stack: error instanceof Error ? error.stack : undefined,
			});
			console.log("CategoryGroup - エラー発生時の状態:", {
				categoryGroups: await chrome.storage.local.get("categoryGroups"),
				localDomains,
			});
			toast.error("カテゴリ名の更新に失敗しました");
		}
	};

	// useSortableフックを使用してドラッグ機能を追加
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({ id: category.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	// ドメインの変更を検知して更新
	useEffect(() => {
		setLocalDomains(domains);
	}, [domains]);

	// このカテゴリ内のすべてのURLを取得
	const allUrls = domains.flatMap((group) => group.urls);

	// ドラッグ&ドロップのためのセンサー
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	// ドラッグオーバー時の処理を追加
	const handleDragOver = (event: React.DragEvent) => {
		event.preventDefault();
		setIsDraggingOver(true);
	};

	// ドラッグリーブ時の処理
	const handleDragLeave = () => {
		setIsDraggingOver(false);
	};

	// ドロップ時の処理
	const handleDrop = (event: React.DragEvent) => {
		event.preventDefault();
		setIsDraggingOver(false);

		const domainId = event.dataTransfer.getData("domain-id");
		const fromCategoryId = event.dataTransfer.getData("from-category-id");

		if (domainId && handleMoveDomainToCategory) {
			// 同じカテゴリへのドロップでなければ処理
			if (fromCategoryId !== category.id) {
				handleMoveDomainToCategory(
					domainId,
					fromCategoryId || null,
					category.id,
				);
			}
		}
	};

	// ドラッグ終了時の処理
	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			// ドメインの並び順を更新
			const oldIndex = localDomains.findIndex(
				(domain) => domain.id === active.id,
			);
			const newIndex = localDomains.findIndex(
				(domain) => domain.id === over.id,
			);

			if (oldIndex !== -1 && newIndex !== -1) {
				const updatedDomains = arrayMove(localDomains, oldIndex, newIndex);
				// ローカル状態を更新
				setLocalDomains(updatedDomains);
				// 親コンポーネントに通知してストレージに保存
				if (handleUpdateDomainsOrder) {
					handleUpdateDomainsOrder(category.id, updatedDomains);
				}
			}
		}
	};

	// カード内のタブをサブカテゴリごとに整理
	const organizeUrlsByCategory = () => {
		type UrlType = { url: string; title: string; subCategory?: string };
		// サブカテゴリでタブをグループ化
		const categorizedUrls: Record<string, UrlType[]> = {
			__uncategorized: [], // 未分類カテゴリを最初に初期化
		};

		// 初期化 - サブカテゴリの初期化
		if (domains[0]?.subCategories) {
			for (const cat of domains[0].subCategories) {
				categorizedUrls[cat] = [];
			}
		}

		// URLを適切なカテゴリに振り分け
		for (const domain of domains) {
			for (const url of domain.urls) {
				if (
					url.subCategory &&
					domain.subCategories?.includes(url.subCategory)
				) {
					categorizedUrls[url.subCategory].push(url);
				} else {
					categorizedUrls.__uncategorized.push(url);
				}
			}
		}

		return categorizedUrls;
	};

	const categorizedUrls = organizeUrlsByCategory();
	const subCategories = [...(domains[0].subCategories || [])];

	// 未分類のタブがあれば、それも表示
	const hasUncategorized = categorizedUrls.__uncategorized.length > 0;

	return (
		<>
			<Card
				ref={setNodeRef}
				style={style}
				className={`${isDraggingOver ? "border-primary" : "border-border"}`}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
			>
				<CardHeader className="flex-row justify-between items-center mb-2">
					<div
						className="flex items-center gap-3 flex-grow cursor-grab hover:cursor-grab active:cursor-grabbing"
						{...attributes}
						{...listeners}
					>
						<span className="text-foreground">
							<GripVertical size={16} aria-hidden="true" />
						</span>
						<h2 className="text-xl font-bold text-foreground">
							{category.name}
						</h2>
						<span className="text-muted-foreground">
							({domains.length}ドメイン / {allUrls.length}タブ)
						</span>
					</div>
					<div className="flex-shrink-0 ml-2 pointer-events-auto flex gap-2">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										console.log("CategoryGroup - カテゴリ管理ボタンクリック", {
											categoryId: category.id,
											categoryName: category.name,
											domainsCount: domains.length,
											currentState: { isModalOpen, isProcessing: false },
										});
										setIsModalOpen(true);
									}}
									className="flex items-center gap-1 cursor-pointer"
									title="カテゴリを管理"
									aria-label="カテゴリを管理"
								>
									<Edit size={14} />
									<span className="lg:inline hidden">カテゴリ管理</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent side="top" className="lg:hidden block">
								カテゴリを管理
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="secondary"
									size="sm"
									onClick={() => handleOpenAllTabs(allUrls)}
									className="flex items-center gap-1 cursor-pointer"
									title="すべてのタブを開く"
									aria-label="すべてのタブを開く"
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
				</CardHeader>
				{!isCollapsed && (
					<CardContent>
						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragEnd={handleDragEnd}
						>
							<SortableContext
								items={localDomains.map((domain) => domain.id)}
								strategy={verticalListSortingStrategy}
							>
								{localDomains.map((group) => (
									<SortableDomainCard
										key={group.id}
										group={group}
										handleOpenAllTabs={handleOpenAllTabs}
										handleDeleteGroup={handleDeleteGroup}
										handleDeleteUrl={handleDeleteUrl}
										handleOpenTab={handleOpenTab}
										handleUpdateUrls={handleUpdateUrls}
										handleDeleteCategory={handleDeleteCategory}
										categoryId={category.id} // 親カテゴリIDを渡す
										isDraggingOver={false}
										settings={settings} // settingsを渡す
									/>
								))}
							</SortableContext>
						</DndContext>
					</CardContent>
				)}
			</Card>

			{/* カテゴリ管理モーダル */}
			<CategoryManagementModal
				isOpen={isModalOpen}
				onClose={() => {
					console.log("CategoryGroup - モーダルを閉じる", {
						categoryId: category.id,
						categoryName: category.name,
						domainsCount: domains.length,
					});
					setIsModalOpen(false);
				}}
				category={category}
				domains={localDomains}
				onCategoryUpdate={handleCategoryUpdate}
			/>
		</>
	);
};
