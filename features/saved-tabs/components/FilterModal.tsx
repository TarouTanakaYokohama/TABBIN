import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type React from 'react'
import { useEffect, useState } from 'react'
import type { DateRange, SelectRangeEventHandler } from 'react-day-picker'

export interface FilterModalProps {
  isOpen: boolean
  onClose: () => void
  startDate: string | null
  endDate: string | null
  onApply: (startDate: string | null, endDate: string | null) => void
  onReset: () => void
}

export const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  startDate,
  endDate,
  onApply,
  onReset,
}) => {
  const [sDate, setSDate] = useState<string>(startDate || '')
  const [eDate, setEDate] = useState<string>(endDate || '')
  // selected date range for calendar
  const [range, setRange] = useState<DateRange | undefined>(
    startDate
      ? {
          from: new Date(startDate),
          to: endDate ? new Date(endDate) : undefined,
        }
      : undefined,
  )

  useEffect(() => {
    setSDate(startDate || '')
    setEDate(endDate || '')
    setRange(
      startDate
        ? {
            from: new Date(startDate),
            to: endDate ? new Date(endDate) : undefined,
          }
        : undefined,
    )
  }, [startDate, endDate])

  const handleRangeSelect: SelectRangeEventHandler = selectedRange => {
    setRange(selectedRange)
    const from = selectedRange?.from
      ? selectedRange.from.toISOString().split('T')[0]
      : ''
    const to = selectedRange?.to
      ? selectedRange.to.toISOString().split('T')[0]
      : ''
    setSDate(from)
    setEDate(to)
  }

  const handleApply = () => {
    onApply(sDate || null, eDate || null)
    onClose()
  }

  const handleReset = () => {
    setSDate('')
    setEDate('')
    onReset()
    onClose()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>詳細フィルター</DialogTitle>
        </DialogHeader>
        <div className='p-4'>
          <Calendar
            mode='range'
            selected={range}
            onSelect={handleRangeSelect}
          />
        </div>
        <DialogFooter>
          <Button variant='ghost' onClick={handleReset}>
            リセット
          </Button>
          <Button variant='default' onClick={handleApply}>
            適用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
