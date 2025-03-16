import { useState, useEffect } from 'react';

/**
 * タイムスタンプを日時形式にフォーマットする関数
 * 「YYYY/MM/DD HH:MM:SS」形式で返します
 * 
 * @param timestamp ミリ秒タイムスタンプ
 * @returns フォーマットされた日時文字列
 */
export function formatDatetime(timestamp?: number): string {
  if (!timestamp) return "-";

  const date = new Date(timestamp);

  // 年月日と時分秒を取得
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  // 「YYYY/MM/DD HH:MM:SS」形式で返す
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 残り時間を表示するコンポーネント
 * 
 * @param props.savedAt タブが保存された時間（ミリ秒タイムスタンプ）
 * @param props.autoDeletePeriod 自動削除期間の設定
 */
export const TimeRemaining = ({
  savedAt,
  autoDeletePeriod,
}: {
  savedAt?: number;
  autoDeletePeriod?: string;
}) => {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [colorClass, setColorClass] = useState<string>("");

  useEffect(() => {
    // 自動削除が無効な場合や保存時刻がない場合は何も表示しない
    if (!autoDeletePeriod || autoDeletePeriod === "never" || !savedAt) {
      setTimeLeft("");
      return;
    }

    // 残り時間を計算する関数
    const calculateTimeLeft = () => {
      // バックグラウンドスクリプトに残り時間計算をリクエスト
      chrome.runtime.sendMessage(
        {
          action: "calculateTimeRemaining",
          savedAt,
          autoDeletePeriod,
        },
        (response) => {
          if (response.error) {
            console.error("残り時間計算エラー:", response.error);
            setTimeLeft("");
            return;
          }

          if (!response.timeRemaining) {
            setTimeLeft("");
            return;
          }

          const remainingMs = response.timeRemaining;

          // 期限切れの場合
          if (remainingMs <= 0) {
            setColorClass("text-red-500");
            setTimeLeft("間もなく削除");
            return;
          }

          // 残り時間を日時分に変換
          const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
          const hours = Math.floor(
            (remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
          );
          const minutes = Math.floor(
            (remainingMs % (1000 * 60 * 60)) / (1000 * 60),
          );

          // 色分け
          if (remainingMs < 1000 * 60 * 60) {
            // 1時間未満は赤
            setColorClass("text-red-500 font-medium");
          } else if (remainingMs < 1000 * 60 * 60 * 24) {
            // 24時間未満はオレンジ
            setColorClass("text-amber-500 font-medium");
          } else if (remainingMs < 1000 * 60 * 60 * 24 * 3) {
            // 3日未満は黄色
            setColorClass("text-yellow-500");
          } else {
            // それ以上は緑
            setColorClass("text-emerald-500");
          }

          // 表示形式を整形
          let result = "あと ";
          if (days > 0) result += `${days}日 `;
          if (hours > 0 || days > 0) result += `${hours}時間 `;
          result += `${minutes}分`;

          setTimeLeft(result);
        },
      );
    };

    // 初回計算
    calculateTimeLeft();

    // 1分ごとに更新
    const timer = setInterval(calculateTimeLeft, 60000);

    return () => clearInterval(timer);
  }, [savedAt, autoDeletePeriod]);

  if (!timeLeft) return null;

  return (
		<span className={`text-xs ${colorClass}`} title="自動削除までの残り時間">
			{timeLeft}
		</span>
  );
};
