import { expect, test } from '@playwright/test'
import {
  getMockRuntimeMessages,
  getMockSetCalls,
  getMockStore,
  installChromeMock,
} from './helpers/mock-chrome'

test.beforeEach(async ({ page }) => {
  await installChromeMock(page)
  await page.goto('/options.html')
  await expect(page.getByRole('heading', { name: 'オプション' })).toBeVisible()
})

test('オプション画面が初期設定で表示される', async ({ page }) => {
  await expect(
    page.getByRole('checkbox', {
      name: '保存したタブを開いた後、リストから自動的に削除する',
    }),
  ).toBeChecked()

  await expect(
    page.getByRole('checkbox', { name: 'URL削除前に確認する' }),
  ).not.toBeChecked()

  await expect(
    page.getByRole('textbox', {
      name: '保存・閉じない URL パターン（1行に1つ）',
    }),
  ).toHaveValue('chrome-extension://\nchrome://')
})

test('チェックボックスの変更がストレージへ保存される', async ({ page }) => {
  const confirmDeleteEach = page.getByRole('checkbox', {
    name: 'URL削除前に確認する',
  })

  await confirmDeleteEach.click()
  await expect(confirmDeleteEach).toBeChecked()

  await expect
    .poll(async () => (await getMockStore(page)).userSettings.confirmDeleteEach)
    .toBe(true)

  await expect
    .poll(async () =>
      (await getMockSetCalls(page)).some(
        call =>
          typeof call.userSettings === 'object' &&
          call.userSettings !== null &&
          (call.userSettings as { confirmDeleteEach?: boolean })
            .confirmDeleteEach === true,
      ),
    )
    .toBe(true)
})

test('クリック挙動の変更がストレージへ保存される', async ({ page }) => {
  const clickBehaviorSelect = page.locator('#click-behavior')
  await clickBehaviorSelect.click()
  await page.getByRole('option', { name: '現在のタブを保存' }).click()

  await expect
    .poll(async () => (await getMockStore(page)).userSettings.clickBehavior)
    .toBe('saveCurrentTab')

  await expect
    .poll(async () =>
      (await getMockSetCalls(page)).some(
        call =>
          typeof call.userSettings === 'object' &&
          call.userSettings !== null &&
          (call.userSettings as { clickBehavior?: string }).clickBehavior ===
            'saveCurrentTab',
      ),
    )
    .toBe(true)
})

test('自動削除期間の確認フローを経由して設定が反映される', async ({ page }) => {
  const autoDeleteSelect = page.locator('#auto-delete-period')
  await autoDeleteSelect.click()
  await page.getByRole('option', { name: '7日' }).click()
  await page.getByRole('button', { name: '設定する' }).click()

  const confirmation = page.getByText('自動削除期間を「7日」に設定します。', {
    exact: false,
  })
  await expect(confirmation).toBeVisible()

  await page.getByRole('button', { name: '確定' }).click()

  await expect(confirmation).toBeHidden()

  await expect
    .poll(async () => (await getMockStore(page)).userSettings.autoDeletePeriod)
    .toBe('7days')

  await expect
    .poll(async () =>
      (await getMockRuntimeMessages(page)).some(
        message =>
          message.action === 'checkExpiredTabs' &&
          message.period === '7days' &&
          message.forceReload === true,
      ),
    )
    .toBe(true)
})

test('自動削除期間の確認ダイアログでキャンセルすると設定は保存されない', async ({
  page,
}) => {
  const autoDeleteSelect = page.locator('#auto-delete-period')
  await autoDeleteSelect.click()
  await page.getByRole('option', { name: '7日' }).click()
  await page.getByRole('button', { name: '設定する' }).click()

  const confirmation = page.getByText('自動削除期間を「7日」に設定します。', {
    exact: false,
  })
  await expect(confirmation).toBeVisible()

  await page.getByRole('button', { name: 'キャンセル' }).click()

  await expect(confirmation).toBeHidden()

  await expect
    .poll(async () => (await getMockStore(page)).userSettings.autoDeletePeriod)
    .toBe('never')

  await expect
    .poll(async () =>
      (await getMockRuntimeMessages(page)).some(
        message => message.action === 'checkExpiredTabs',
      ),
    )
    .toBe(false)
})

test('除外URLパターンはフォーカスを外したタイミングで空行除去して保存される', async ({
  page,
}) => {
  const excludePatterns = page.getByRole('textbox', {
    name: '保存・閉じない URL パターン（1行に1つ）',
  })

  await excludePatterns.fill('chrome-extension://\n\nhttps://example.com/*')
  await excludePatterns.evaluate(element =>
    (element as HTMLTextAreaElement).blur(),
  )

  await expect
    .poll(async () => (await getMockStore(page)).userSettings.excludePatterns)
    .toEqual(['chrome-extension://', 'https://example.com/*'])

  await expect
    .poll(async () =>
      (await getMockSetCalls(page)).some(call => {
        if (
          typeof call.userSettings !== 'object' ||
          call.userSettings === null
        ) {
          return false
        }
        const excludePatterns = (
          call.userSettings as { excludePatterns?: string[] }
        ).excludePatterns
        return (
          Array.isArray(excludePatterns) &&
          excludePatterns.length === 2 &&
          excludePatterns[0] === 'chrome-extension://' &&
          excludePatterns[1] === 'https://example.com/*'
        )
      }),
    )
    .toBe(true)
})
