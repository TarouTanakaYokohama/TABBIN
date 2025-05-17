/**
 * デフォルトカラー設定
 */

// デフォルトカラー値を取得する関数
export const getDefaultColor = (key: string): string => {
  return defaultColors[key] || '#ffffff'
}

// デフォルトカラー設定
export const defaultColors: Record<string, string> = {
  background: '#ffffff',
  foreground: '#09090b',
  card: '#ffffff',
  'card-foreground': '#09090b',
  popover: '#ffffff',
  'popover-foreground': '#09090b',
  primary: '#0ea5e9',
  'primary-foreground': '#ffffff',
  secondary: '#f1f5f9',
  'secondary-foreground': '#0f172a',
  muted: '#f1f5f9',
  'muted-foreground': '#64748b',
  accent: '#f1f5f9',
  'accent-foreground': '#0f172a',
  destructive: '#ef4444',
  'destructive-foreground': '#ffffff',
  border: '#e2e8f0',
  input: '#e2e8f0',
  ring: '#0ea5e9',
  'chart-1': '#0ea5e9',
  'chart-2': '#10b981',
  'chart-3': '#f59e0b',
  'chart-4': '#ef4444',
  'chart-5': '#8b5cf6',
  sidebar: '#f8fafc',
  'sidebar-foreground': '#0f172a',
  'sidebar-primary': '#0ea5e9',
  'sidebar-primary-foreground': '#ffffff',
  'sidebar-accent': '#f1f5f9',
  'sidebar-accent-foreground': '#0f172a',
  'sidebar-border': '#e2e8f0',
  'sidebar-ring': '#0ea5e9',
}
