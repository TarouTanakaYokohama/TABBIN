import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { CategoryGroupProps } from "@/types/saved-tabs";
import { useSensors, useSensor, PointerSensor, KeyboardSensor, DragEndEvent, DndContext, closestCenter } from "@dnd-kit/core";
import { useSortable, sortableKeyboardCoordinates, arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GripVertical, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { SortableDomainCard } from "./SortableDomainCard";
import { CSS } from "@dnd-kit/utilities";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
    // ドメインの状態を追加
    const [localDomains, setLocalDomains] = useState<TabGroup[]>(domains);

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
                    <h2 className="text-xl font-bold text-foreground">{category.name}</h2>
                    <span className="text-muted-foreground">
                        ({domains.length}ドメイン / {allUrls.length}タブ)
                    </span>
                </div>
                <div className="flex-shrink-0 ml-2 pointer-events-auto">
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
    );
};