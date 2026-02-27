// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog'

describe('AlertDialogコンポーネント', () => {
  it('Triggerにdata-slotを付与して描画する', () => {
    render(
      <AlertDialog open>
        <AlertDialogTrigger>Open Alert</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Title</AlertDialogTitle>
          <AlertDialogDescription>Description</AlertDialogDescription>
          <AlertDialogAction>OK</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    )

    const trigger = screen.getByRole('button', {
      name: 'Open Alert',
      hidden: true,
    })
    expect(trigger.getAttribute('data-slot')).toBe('alert-dialog-trigger')
  })
})
