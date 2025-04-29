import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  BackupData,
  downloadAsJson,
  exportSettings,
  importSettings,
} from '@/utils/importExport'
import { AlertCircle, Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

export const ImportExportSettings: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mergeData, setMergeData] = useState(true) // マージオプションの状態

  // エクスポート処理
  const handleExport = async () => {
    try {
      setIsExporting(true)
      const data = await exportSettings()

      // ファイル名に日付を追加 (YYYY-MM-DD形式)
      const date = new Date()
      const formattedDate = date.toISOString().split('T')[0]
      const filename = `tab-manager-backup-${formattedDate}.json`

      downloadAsJson(data, filename)
      toast.success('設定とタブデータをエクスポートしました')
    } catch (error) {
      console.error('エクスポートエラー:', error)
      toast.error('エクスポート中にエラーが発生しました')
    } finally {
      setIsExporting(false)
    }
  }

  // インポートダイアログを開く
  const handleOpenImportDialog = () => {
    setImportDialogOpen(true)
  }

  // ファイル選択を開く
  const handleSelectFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // ファイル読み込み処理
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)

    const reader = new FileReader()
    reader.onload = async event => {
      try {
        const content = event.target?.result as string
        if (!content) {
          toast.error('ファイルの読み込みに失敗しました')
          return
        }

        const result = await importSettings(content, mergeData) // マージオプションを渡す
        if (result.success) {
          toast.success(result.message)
          setImportDialogOpen(false)

          // バックグラウンドに更新を通知
          chrome.runtime.sendMessage({ action: 'settingsImported' })
        } else {
          toast.error(result.message)
        }
      } catch (error) {
        console.error('インポートエラー:', error)
        toast.error('インポートに失敗しました')
      } finally {
        setIsImporting(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }

    reader.onerror = () => {
      toast.error('ファイルの読み込みに失敗しました')
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }

    reader.readAsText(file)
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap gap-2'>
        <Button
          onClick={handleExport}
          disabled={isExporting}
          variant='outline'
          className='flex items-center gap-2'
        >
          <Download size={16} />
          {isExporting ? 'エクスポート中...' : '設定とタブデータをエクスポート'}
        </Button>

        <Button
          onClick={handleOpenImportDialog}
          disabled={isImporting}
          variant='outline'
          className='flex items-center gap-2'
        >
          <Upload size={16} />
          {isImporting ? 'インポート中...' : '設定とタブデータをインポート'}
        </Button>
      </div>

      <input
        type='file'
        ref={fileInputRef}
        accept='.json'
        onChange={handleFileChange}
        className='hidden'
      />

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>設定とタブデータのインポート</DialogTitle>
            <DialogDescription>
              以前にエクスポートしたバックアップファイルから設定とタブデータを復元します。
            </DialogDescription>
          </DialogHeader>

          {/* マージオプションを追加 */}
          <div className='flex items-center space-x-2 mb-4'>
            <Checkbox
              id='merge-data'
              checked={mergeData}
              onCheckedChange={checked => setMergeData(checked === true)}
            />
            <Label htmlFor='merge-data' className='cursor-pointer'>
              既存データとマージする（推奨）
            </Label>
          </div>

          <div className='text-sm text-muted-foreground mb-4'>
            <p>
              {mergeData
                ? '既存のデータを保持しつつ、新しいデータを追加・更新します。'
                : '警告：既存のデータをすべて置き換えます。'}
            </p>
          </div>

          <Alert
            variant={mergeData ? 'default' : 'destructive'}
            className='my-4'
          >
            <AlertCircle className='h-4 w-4' />
            <AlertTitle>{mergeData ? '注意' : '警告'}</AlertTitle>
            <AlertDescription>
              {mergeData
                ? 'マージの際、同じIDのデータは更新されます。'
                : 'インポートすると現在の設定とタブデータがすべて上書きされます。この操作は元に戻せません。'}
            </AlertDescription>
          </Alert>

          <DialogFooter className='flex flex-col sm:flex-row sm:justify-between gap-2'>
            <Button
              variant='secondary'
              onClick={() => setImportDialogOpen(false)}
              disabled={isImporting}
            >
              キャンセル
            </Button>
            <Button
              variant='default'
              onClick={handleSelectFile}
              disabled={isImporting}
              className='flex items-center gap-2'
            >
              <Upload size={16} />
              {isImporting ? 'インポート中...' : 'バックアップファイルを選択'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
