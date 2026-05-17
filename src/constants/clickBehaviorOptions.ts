/**
 * Click behavior option definitions.
 */
export const clickBehaviorOptions = [
  { value: 'saveCurrentTab', labelKey: 'options.clickBehavior.currentTab' },
  { value: 'saveWindowTabs', labelKey: 'options.clickBehavior.windowTabs' },
  {
    value: 'saveSameDomainTabs',
    labelKey: 'options.clickBehavior.sameDomain',
  },
  {
    value: 'saveAllWindowsTabs',
    labelKey: 'options.clickBehavior.allWindows',
  },
] as const
