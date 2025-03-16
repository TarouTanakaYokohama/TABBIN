import { Button } from "@/components/ui/button";
import type { SortableUrlItemProps } from "@/types/saved-tabs";
import { useSortable } from "@dnd-kit/sortable";
import { GripVertical, X } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { CSS } from "@dnd-kit/utilities";

// URL項目用のソータブルコンポーネント - 型定義を修正
export const SortableUrlItem = ({
	url,
	title,
	id,
	groupId,
	subCategory,
	savedAt, // 個別プロパティとして受け取る
	autoDeletePeriod, // 個別プロパティとして受け取る
	availableSubCategories = [],
	handleDeleteUrl,
	handleOpenTab,
	handleSetSubCategory,
	categoryContext,
	settings,
}: SortableUrlItemProps) => {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({
			id,
			data: {
				categoryContext, // カテゴリコンテキストをデータに追加
			},
		});

	const [isDragging, setIsDragging] = useState(false);
	const [leftWindow, setLeftWindow] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const dragTimeoutRef = useRef<number | null>(null);
	const [isDeleteButtonVisible, setIsDeleteButtonVisible] = useState(false);
	const buttonTimeoutRef = useRef<number | null>(null);

	// ドラッグが開始されたとき
	const handleDragStart = (
		e: React.DragEvent<HTMLButtonElement>,
		url: string,
	) => {
		setIsDragging(true);
		setLeftWindow(false);
		// URLをテキストとして設定
		e.dataTransfer.setData("text/plain", url);
		// URI-listとしても設定（多くのブラウザやアプリがこのフォーマットを認識）
		e.dataTransfer.setData("text/uri-list", url);

		console.log("ドラッグ開始:", url);

		// ドキュメント全体のmouseleaveイベントを監視
		document.addEventListener("mouseleave", handleMouseLeave);

		// ドラッグ開始をバックグラウンドに通知
		chrome.runtime.sendMessage(
			{
				action: "urlDragStarted",
				url: url,
				groupId: groupId,
			},
			(response) => {
				console.log("ドラッグ開始通知の応答:", response);
			},
		);
	};

	// 外部ウィンドウへのドロップ処理
	const handleExternalDrop = useCallback(() => {
		// 外部へのドロップ時にタブを削除するよう通知
		chrome.runtime.sendMessage(
			{
				action: "urlDropped",
				url: url,
				groupId: groupId,
				fromExternal: true,
			},
			(response) => {
				console.log("外部ドロップ後の応答:", response);
			},
		);
	}, [url, groupId]);

	const handleDragEnd = (e: React.DragEvent<HTMLButtonElement>) => {
		// リスナーをクリーンアップ
		document.removeEventListener("mouseleave", handleMouseLeave);

		// タイムアウトをクリア
		if (dragTimeoutRef.current) {
			clearTimeout(dragTimeoutRef.current);
			dragTimeoutRef.current = null;
		}

		setIsDragging(false);
		console.log("ドラッグ終了:", e.dataTransfer.dropEffect);

		// 内部で完了した場合は、leftWindowフラグをリセット
		setLeftWindow(false);
	};

	// マウスリーブハンドラをメモ化
	const handleMouseLeave = useCallback(() => {
		// マウスがウィンドウを出たことを記録
		setLeftWindow(true);
		console.log("マウスがウィンドウから出ました");

		// windowに戻ってこなければ、タイムアウト後に外部ウィンドウへのドロップと判定
		if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
		dragTimeoutRef.current = window.setTimeout(() => {
			if (isDragging && leftWindow) {
				console.log("外部ウィンドウへのドラッグを検出:", url);
				handleExternalDrop();
			}
		}, 1000) as unknown as number;
	}, [isDragging, leftWindow, url, handleExternalDrop]);

	// コンポーネントのアンマウント時にクリーンアップ
	useEffect(() => {
		return () => {
			document.removeEventListener("mouseleave", handleMouseLeave);
			if (dragTimeoutRef.current) {
				clearTimeout(dragTimeoutRef.current);
			}
		};
	}, [handleMouseLeave]);

	// マウスイベントの処理を改善
	const handleMouseEnter = () => {
		setIsHovered(true);
		setIsDeleteButtonVisible(true);
		// タイマーをクリア
		if (buttonTimeoutRef.current) {
			clearTimeout(buttonTimeoutRef.current);
			buttonTimeoutRef.current = null;
		}
	};

	const handleUIMouseLeave = () => {
		setIsHovered(false);
		// ボタンの非表示を少し遅らせて、ボタンへのマウス移動を可能にする
		buttonTimeoutRef.current = window.setTimeout(() => {
			setIsDeleteButtonVisible(false);
		}, 300) as unknown as number;
	};

	// コンポーネントのアンマウント時にクリーンアップ
	useEffect(() => {
		return () => {
			if (buttonTimeoutRef.current) {
				clearTimeout(buttonTimeoutRef.current);
			}
		};
	}, []);

	// 削除ボタンのマウスイベント処理
	const handleDeleteButtonMouseEnter = () => {
		// タイマーをクリアして非表示にならないようにする
		if (buttonTimeoutRef.current) {
			clearTimeout(buttonTimeoutRef.current);
			buttonTimeoutRef.current = null;
		}
		setIsDeleteButtonVisible(true);
	};

	const handleDeleteButtonClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		handleDeleteUrl(groupId, url);
	};

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<li
			ref={setNodeRef}
			style={style}
			className="border-b border-border pb-1 last:border-0 last:pb-0 flex items-center relative overflow-hidden"
			data-category-context={categoryContext} // カテゴリコンテキストをdata属性に追加
		>
			<div
				className="text-muted-foreground/40 cursor-grab hover:cursor-grab active:cursor-grabbing mr-2 z-10 flex-shrink-0"
				{...attributes}
				{...listeners}
			>
				<GripVertical size={16} aria-hidden="true" />
			</div>
			<div className="flex-1 relative min-w-0">
				<Button
					variant="ghost"
					size="sm"
					draggable="true"
					onDragStart={(e) => handleDragStart(e, url as string)}
					onDragEnd={handleDragEnd}
					onClick={() => handleOpenTab(url)}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleUIMouseLeave}
					className="text-foreground hover:text-foreground hover:underline cursor-pointer text-left w-full bg-transparent border-0 flex items-center gap-1 h-full justify-start px-0 pr-8 overflow-hidden"
					title={title}
				>
					<div className="flex flex-col truncate w-full">
						<span className="truncate">{title}</span>
						{/* 保存日時と残り時間を表示 - settings.showSavedTime に基づき条件分岐 */}
						{savedAt && (
							<div className="flex gap-2 items-center text-xs">
								{settings.showSavedTime && (
									<span className="text-muted-foreground">
										{formatDatetime(savedAt)}
									</span>
								)}
								{autoDeletePeriod && autoDeletePeriod !== "never" && (
									<TimeRemaining
										savedAt={savedAt}
										autoDeletePeriod={autoDeletePeriod}
									/>
								)}
							</div>
						)}
					</div>
				</Button>
				{isDeleteButtonVisible && (
					<Button
						variant="outline"
						size="icon"
						onClick={handleDeleteButtonClick}
						onMouseEnter={handleDeleteButtonMouseEnter}
						className="absolute right-0 top-0 bottom-0 my-auto flex-shrink-0 cursor-pointer"
						title="URLを削除"
						aria-label="URLを削除"
					>
						<X size={14} />
					</Button>
				)}
			</div>
		</li>
	);
};
