const messages = {
  en: {
    'aiChat.deleteConversationAria': 'Delete {{title}}',
    'aiChat.deleteDescription': 'This action cannot be undone.',
    'aiChat.deleteTitle': 'Delete this conversation?',
    'aiChat.historyHint': 'Click to continue',
    'aiChat.historyTitle': 'Recent conversations',
    'aiChat.open': 'Open AI chat',
    'aiChat.close': 'Close AI chat',
    'aiChat.chatTitle': 'Chat',
    'aiChat.sidebarAria': 'AI chat sidebar',
    'aiChat.pageAria': 'AI chat page',
    'aiChat.resizeAria': 'Resize the AI chat width',
    'aiChat.scrollLatest': 'Jump to latest message',
    'aiChat.send': 'Send',
    'aiChat.sending': 'Sending...',
    'aiChat.inputLabel': 'Ask AI',
    'aiChat.inputPlaceholder': 'Ask about your saved tabs',
    'aiChat.inputPlaceholderSelectModel':
      'Select an Ollama model in the lower-left corner',
    'aiChat.emptySelectModel': 'Select a model',
    'aiChat.intro': 'Ask questions about your saved tabs.',
    'aiChat.suggestion.recentTabs': 'Show me the tabs I added this month',
    'aiChat.suggestion.favoriteContent':
      'What kinds of content do I save most often?',
    'aiChat.suggestion.recommendation': 'Tell me what content I might like',
    'aiChat.sources.one': '{{count}} source',
    'aiChat.sources.other': '{{count}} sources',
    'aiChat.shimmer': 'Assembling the answer...',
    'aiChat.reasoning': 'Reasoning',
    'aiChat.toolsRun': 'Tools run',
    'aiChat.copyConversation': 'Copy conversation',
    'aiChat.copyConversationSuccess': 'Copied the conversation',
    'aiChat.copyConversationError': 'Could not copy the conversation',
    'aiChat.newConversation': 'New conversation',
    'aiChat.attachments.add': 'Attach files',
    'aiChat.attachments.deleteAria': 'Delete {{filename}}',
    'aiChat.attachments.defaultName': 'attachment',
    'aiChat.attachments.unsupportedType':
      'Only text files and image files are supported.',
    'aiChat.attachments.unsupportedTypeDetail':
      '{{filename}} is not supported in the current AI chat ({{mediaType}}).',
    'aiChat.attachments.maxFileSize': 'Attachments must be 2 MB or smaller.',
    'aiChat.attachments.maxFiles': 'You can attach up to {{count}} files.',
    'aiChat.attachments.readError': 'Could not read the attachment.',
    'aiChat.streaming.receivedQuestion': '- Received question: {{prompt}}',
    'aiChat.streaming.checkingTabs': '- Checking saved tabs.',
    'aiChat.streaming.toolsFollow':
      '- Tools and reasoning update after each completed step.',
    'aiChat.copy.user': 'User:',
    'aiChat.copy.assistant': 'AI:',
    'aiChat.copy.attachments': 'Attachments:',
    'aiChat.systemPrompt.select': 'Select a system prompt',
    'aiChat.systemPrompt.placeholder': 'Prompt',
    'aiChat.systemPrompt.empty': 'No system prompts available',
    'aiChat.systemPrompt.managerTitle': 'System prompt manager',
    'aiChat.systemPrompt.listTitle': 'System prompts',
    'aiChat.systemPrompt.inUse': 'In use',
    'aiChat.systemPrompt.new': 'New prompt',
    'aiChat.systemPrompt.nameLabel': 'Prompt name',
    'aiChat.systemPrompt.bodyLabel': 'System prompt body',
    'aiChat.systemPrompt.duplicate': 'Duplicate',
    'aiChat.systemPrompt.availableTools': 'Available tools',
    'aiChat.systemPrompt.availableToolsDescription':
      'Tool names and descriptions are listed here so you can easily include them in a system prompt.',
    'aiChat.systemPrompt.validation.empty':
      'Enter both a prompt name and system prompt body.',
    'aiChat.systemPrompt.validation.maxLength':
      'Prompt names must be within {{count}} characters.',
    'aiChat.systemPrompt.validation.duplicate':
      'You cannot save prompts with the same name.',
    'aiChat.systemPrompt.saving': 'Saving...',
    'aiChat.systemPrompt.save': 'Save',
    'aiChat.systemPrompt.saveError': 'Could not save the system prompts',
    'aiChat.systemPrompt.switchSaveError':
      'Could not save the system prompt change',
    'aiChat.systemPrompt.openSettings': 'Open system prompt settings',
    'aiChat.systemPrompt.settingsTooltip': 'System prompt settings',
    'aiChat.systemPrompt.copySuffix': ' copy',
    'aiChat.responseError': 'Could not get a response from AI.',
    'aiChat.interruptedResponse':
      'The previous response was interrupted. Send your message again if needed.',
    'aiChat.modelListLoadError': 'Could not load the model list',
    'aiChat.modelSettingsSaveError': 'Could not save model settings',
    'aiChat.history.resumeHint': 'Resume from a saved conversation',
    'aiChat.history.empty': 'No saved conversations yet',
    'aiChat.history.startPrompt': 'Start a new conversation',
    'aiChat.ollama.loadModels': 'Load models',
    'aiChat.ollama.loading': 'Loading...',
    'aiChat.ollama.loadingModelList': 'Loading model list...',
    'aiChat.ollama.noModelsFound': 'No models found',
    'aiChat.ollama.selectModel': 'Select a model',
    'aiChat.ollama.copy': 'Copy',
    'aiChat.ollama.copied': 'Copied',
    'aiChat.ollama.copyCommand': 'Copy command',
    'aiChat.ollama.copyValue': 'Copy value',
    'aiChat.ollama.copyCheckCommand': 'Copy check command',
    'aiChat.ollama.copyError': 'Could not copy {{label}}',
    'aiChat.ollama.copySuccess': 'Copied {{label}}',
    'aiChat.ollama.connectionError': 'Could not connect to Ollama.',
    'aiChat.ollama.forbiddenError':
      'Ollama denied access from the extension (403 Forbidden).',
    'aiChat.ollama.notInstalledDownload':
      'If you have not installed Ollama yet, download it.',
    'aiChat.ollama.notInstalledStart':
      'If it is already installed, start Ollama.',
    'aiChat.ollama.setOrigins': 'Set OLLAMA_ORIGINS to the following value.',
    'aiChat.ollama.connectionUrl': 'Connection URL:',
    'aiChat.ollama.tagsUrl': 'Tags URL:',
    'aiChat.ollama.checkCommand':
      'Copy and paste the check command to verify the connection.',
    'aiChat.ollama.downloadUrl': 'Download URL:',
    'aiChat.ollama.faq': 'FAQ:',
    'aiChat.ollama.mac.step1': 'Open Terminal from Spotlight search.',
    'aiChat.ollama.mac.step2': 'Copy and paste the following command.',
    'aiChat.ollama.mac.step3': 'Press the Return key.',
    'aiChat.ollama.mac.step4': 'Quit Ollama.app.',
    'aiChat.ollama.mac.step5': 'Launch Ollama.app again.',
    'aiChat.ollama.win.step1':
      'Search for Environment Variables in the Windows start menu.',
    'aiChat.ollama.win.step2': 'Open Edit the system environment variables.',
    'aiChat.ollama.win.step3':
      'In the window that appears, select Environment Variables.',
    'aiChat.ollama.win.step4': 'Under User variables, select New.',
    'aiChat.ollama.win.step5': 'Enter OLLAMA_ORIGINS as the variable name.',
    'aiChat.ollama.win.step6':
      'Enter the following value as the variable value.',
    'aiChat.ollama.win.step7': 'Save the setting and restart Ollama.',
    'aiChat.ollama.unknown.step1':
      'Set OLLAMA_ORIGINS and then restart Ollama.',
    'aiChat.ollama.unknown.step2': 'The value is below.',
    'background.aiChat.ollama.macTitle': 'If you use Ollama.app on macOS:',
    'background.aiChat.ollama.setOriginsValue':
      'Set OLLAMA_ORIGINS to {{value}}.',
    'background.aiChat.savedTabsCount': 'Saved tabs: {{count}}',
    'background.aiChat.recentTabs': 'Recently saved tabs:',
    'background.aiChat.intent.list': 'Review the list of saved tabs',
    'background.aiChat.intent.interests': 'Infer saved-tab trends',
    'background.aiChat.intent.time': 'Check timing and saved periods',
    'background.aiChat.intent.search': 'Search and summarize saved tabs',
    'background.aiChat.toolSummary.fetchedWithTotal':
      'Retrieved {{count}} items. Total items: {{total}}.',
    'background.aiChat.toolSummary.fetchedCount': 'Reviewed {{count}} results.',
    'background.aiChat.toolSummary.resultRetrieved': 'Retrieved the result.',
    'background.aiChat.toolSummary.callReviewed':
      'Reviewed the tool call details.',
    'background.aiChat.reasoning.intentLabel': 'Question understanding:',
    'background.aiChat.reasoning.referenceLabel': 'Reference scope:',
    'background.aiChat.reasoning.toolsLabel': 'Tools used:',
    'background.aiChat.reasoning.policyLabel': 'Answering approach:',
    'background.aiChat.reasoning.policyWithTools':
      'Answered using tool results as evidence from your saved tabs.',
    'background.aiChat.reasoning.policyWithoutTools':
      'Answered directly from the saved-tab summary context.',
    'background.aiChat.none': 'None',
    'aiChat.systemPrompt.defaultName': 'Default',
    'aiChat.systemPrompt.defaultTemplate':
      'You are an assistant that answers only based on the tabs saved in TABBIN.\nDo not infer facts that are not present in the saved data.\nIf an answer includes inference, explicitly say "Based on your saved trends".\nWhen asked about months or periods, answer with as specific year and month as possible.\nIf asked what tabs are currently saved, first check with listSavedUrls.\nOnly say there are no saved tabs when the tool results or saved-tab summary are empty.\nAnswer concisely in English.',
    'aiChat.attachments.contextTitle': 'Attachment contents:',
    'aiChat.interests.savedCountLabel': 'Saved count',
    'aiChat.interests.categoryShareDescription':
      'Share of recently saved categories',
    'aiChat.interests.topCategoriesTitle': 'Frequently saved genres',
    'aiChat.interests.categoryCountDescription':
      'Saved count by recently saved category',
    'aiChat.interests.categoryCountTitle': 'Saved count by genre',
    'aiChat.interests.domainCountDescription':
      'Saved count by recently saved domain',
    'aiChat.interests.topDomainsTitle': 'Frequently saved domains',
    'aiChat.interests.noDataSummary':
      'There is no saved data yet, so I cannot infer your interests.',
    'aiChat.interests.tentativeSummary':
      'There are only a few saved items so far, so it is still hard to infer a strong trend.',
    'aiChat.interests.categoryBias':
      'Categories such as {{categories}} stand out.',
    'aiChat.interests.categoryWeak': 'No strong category bias is visible yet.',
    'aiChat.interests.summary':
      'Based on your saved trends, interest is strongest around {{domainSummary}}, and {{categorySummary}}',
    'analytics.groupBy.domain': 'Domain',
    'analytics.groupBy.timeRecent': 'Time series (recent)',
    'analytics.groupBy.timeTop': 'Time series (top counts)',
    'analytics.groupBy.parentCategory': 'Parent category',
    'analytics.groupBy.subCategory': 'Sub category',
    'analytics.groupBy.project': 'Project',
    'analytics.chartType.bar': 'Bar chart',
    'analytics.chartType.line': 'Line chart',
    'analytics.chartType.area': 'Area chart',
    'analytics.chartType.pie': 'Pie chart',
    'analytics.chartType.radar': 'Radar',
    'analytics.uncategorized': 'Uncategorized',
    'analytics.aiSummary': 'This is an AI-generated analytics chart.',
    'analytics.conditionsTitle': 'Analysis conditions',
    'analytics.viewName': 'View name',
    'analytics.groupByLabel': 'Group by',
    'analytics.chartTypeLabel': 'Chart type',
    'analytics.limitLabel': 'Top count',
    'analytics.saveView': 'Save',
    'analytics.savedViewsTitle': 'Saved views',
    'analytics.savedViewsDescription':
      'Reuse saved analytics conditions from here.',
    'analytics.savedViewsEmpty': 'No saved analytics views yet.',
    'analytics.deleteViewAria': 'Delete {{name}}',
    'analytics.canvasTitle': 'Analytics canvas',
    'analytics.drilldownTitle': 'Saved tabs in this item',
    'analytics.drilldownCount': '{{count}} items',
    'analytics.drilldownEmpty': 'No matching saved tabs were found.',
    'analytics.open': 'Open',
    'analytics.openAria': 'Open {{title}}',
    'analytics.chart.savedCountByDomain': 'Saved count by domain',
    'analytics.chart.savedCountByParentCategory':
      'Saved count by parent category',
    'analytics.chart.savedCountBySubCategory': 'Saved count by sub category',
    'analytics.chart.savedCountByProject': 'Saved count by project',
    'analytics.chart.savedCountByProjectCategory':
      'Saved count by project category',
    'analytics.chart.dailySavedTrend': 'Daily saved trend',
    'analytics.chart.weeklySavedTrend': 'Weekly saved trend',
    'analytics.chart.monthlySavedTrend': 'Monthly saved trend',
    'analytics.chart.descriptionAggregated':
      '{{count}} saved records aggregated',
    'analytics.chart.descriptionCompareMode':
      '{{count}} saved records compared by mode',
    'analytics.chart.seriesSavedCount': 'Saved count',
    'analytics.chart.seriesShare': 'Share',
    'analytics.chart.seriesDomainMode': 'Domain mode',
    'analytics.chart.seriesCustomMode': 'Custom mode',
    'analytics.summary': 'Created {{title}} from {{count}} saved records.',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.console': 'Console',
    'common.copy': 'Copy',
    'common.enterUrl': 'Enter URL...',
    'common.delete': 'Delete',
    'common.input': 'Input',
    'common.instructions': 'Instructions',
    'common.output': 'Output',
    'common.next': 'Next',
    'common.reasoning': 'Reasoning',
    'common.cache': 'Cache',
    'common.loading': 'Loading...',
    'common.loadingLabel': 'Loading',
    'common.manage': 'Manage',
    'common.modelContextUsage': 'Model context usage',
    'common.nextBranch': 'Next branch',
    'common.nextSlide': 'Next slide',
    'common.noConsoleOutput': 'No console output',
    'common.noDescription': 'No description',
    'common.noStackFrames': 'No stack frames',
    'common.open': 'Open',
    'common.parameters': 'Parameters',
    'common.pausePreview': 'Pause preview',
    'common.previousBranch': 'Previous branch',
    'common.previousSlide': 'Previous slide',
    'common.previous': 'Previous',
    'common.preview': 'Preview',
    'common.playPreview': 'Play preview',
    'common.reset': 'Reset',
    'common.requestBody': 'Request Body',
    'common.required': 'required',
    'common.result': 'Result',
    'common.response': 'Response',
    'common.searchMicrophones': 'Search microphones...',
    'common.stop': 'Stop',
    'common.submit': 'Submit',
    'common.togglePlan': 'Toggle plan',
    'common.thinking': 'Thinking...',
    'common.thoughtForFewSeconds': 'Thought for a few seconds',
    'common.thoughtForSeconds': 'Thought for {{count}} seconds',
    'common.totalCost': 'Total cost',
    'common.tools': 'Tools',
    'common.toggleSidebar': 'Toggle Sidebar',
    'common.toggleValueVisibility': 'Toggle value visibility',
    'common.uploadFiles': 'Upload files',
    'common.usedSources.one': 'Used {{count}} source',
    'common.usedSources.other': 'Used {{count}} sources',
    'theme.toggle': 'Toggle theme',
    'theme.light': 'Light mode',
    'theme.dark': 'Dark mode',
    'theme.system': 'System setting',
    'theme.user': 'User setting',
    'language.english': 'English',
    'language.japanese': 'Japanese',
    'language.label': 'Display language',
    'language.system': 'System',
    'changelog.heading': 'Release Notes',
    'htmlTitle.aiChat': 'AI Chat - TABBIN',
    'htmlTitle.app': 'TABBIN',
    'htmlTitle.analytics': 'Analytics - TABBIN',
    'htmlTitle.changelog': 'Release Notes - TABBIN',
    'htmlTitle.options': 'Options - TABBIN',
    'htmlTitle.periodicExecution': 'Scheduled tasks - TABBIN',
    'htmlTitle.savedTabs': 'Saved tabs - TABBIN',
    'options.backupRestore': 'Backup & Restore',
    'options.autoDelete.1day': '1 day',
    'options.autoDelete.14days': '14 days',
    'options.autoDelete.180days': '6 months',
    'options.autoDelete.1hour': '1 hour',
    'options.autoDelete.30days': '30 days',
    'options.autoDelete.365days': '1 year',
    'options.autoDelete.7days': '7 days',
    'options.autoDelete.allWindows': 'Open all tabs including other windows',
    'options.autoDelete.allWindowsDescription':
      'When enabled, the "Open all" button opens tabs in a new window.',
    'options.autoDelete.apply': 'Apply',
    'options.autoDelete.background': 'Open in background tabs',
    'options.autoDelete.confirmDeleteAll': 'Confirm before deleting all',
    'options.autoDelete.confirmDeleteAllDescription':
      'When enabled, a confirmation dialog appears before deleting all tabs in a category.',
    'options.autoDelete.confirmDeleteEach': 'Confirm before deleting tabs',
    'options.autoDelete.confirmDeleteEachDescription':
      'When enabled, a confirmation dialog appears before deleting a tab.',
    'options.autoDelete.confirmMessage':
      'Set auto-delete period to "{{periodLabel}}".\n\n{{warningMessage}}\n\nContinue?',
    'options.autoDelete.description':
      'Saved tabs are deleted automatically after the selected period.',
    'options.autoDelete.externalDrop':
      'Delete automatically after dropping into another browser',
    'options.autoDelete.externalDropDescription':
      'When enabled, saved tabs are removed after you drag and drop them into another browser.',
    'options.autoDelete.excludePinned': 'Exclude pinned tabs',
    'options.autoDelete.excludePinnedDescription':
      'When enabled, pinned tabs are excluded from saved tabs.',
    'options.autoDelete.enabled': 'Set auto-delete period to "{{periodLabel}}"',
    'options.autoDelete.disabled': 'Disabled auto delete',
    'options.autoDelete.openAfter':
      'Delete automatically after opening a saved tab',
    'options.autoDelete.openAfterDescription':
      'When enabled, a saved tab is removed from the list after you open it. When disabled, the tab stays in the list.',
    'options.autoDelete.savedTime': 'Show saved time',
    'options.autoDelete.savedTimeDescription':
      'When enabled, the saved date is shown in the saved tabs list.',
    'options.autoDelete.saveInBackground': 'Open in background tabs',
    'options.autoDelete.saveInBackgroundDescription':
      'When enabled, saved tabs open in the background.',
    'options.autoDelete.periodDescription':
      'Saved tabs are deleted automatically when they exceed the selected period. Applying the setting deletes tabs that have already expired.',
    'options.autoDelete.periodLabel': 'Auto-delete period for tabs',
    'options.autoDelete.selectPlaceholder': 'Select an auto-delete period',
    'options.autoDelete.shorterWarning':
      'Warning: This shortens the current period, so some tabs may be deleted immediately!',
    'options.autoDelete.validateWarning':
      'Note: Tabs older than the selected period may be deleted immediately.',
    'options.autoDelete.saveError': 'Failed to save settings',
    'options.autoDelete.title': 'Auto delete',
    'options.autoDelete.zero': 'Do not auto delete',
    'options.behavior.description':
      'When enabled, tabs are opened in a new window.',
    'options.behaviorSettings': 'Tab behavior',
    'options.clickBehavior.allWindows': 'Save all tabs including other windows',
    'options.clickBehavior.currentTab': 'Save current tab',
    'options.clickBehavior.sameDomain': 'Save all tabs from the current domain',
    'options.clickBehavior.windowTabs': 'Save all tabs in the window',
    'options.clickBehaviorLabel': 'Click action',
    'options.clickBehaviorPlaceholder': 'Select click action',
    'options.color.accent': 'Accent background',
    'options.color.accentForeground': 'Accent text',
    'options.color.background': 'Background',
    'options.color.border': 'Border',
    'options.color.card': 'Card background',
    'options.color.cardForeground': 'Card text',
    'options.color.chart1': 'Chart 1',
    'options.color.chart2': 'Chart 2',
    'options.color.chart3': 'Chart 3',
    'options.color.chart4': 'Chart 4',
    'options.color.chart5': 'Chart 5',
    'options.color.destructive': 'Destructive background',
    'options.color.destructiveForeground': 'Destructive text',
    'options.color.foreground': 'Text',
    'options.color.input': 'Input background',
    'options.color.muted': 'Muted background',
    'options.color.mutedForeground': 'Sub text',
    'options.color.popover': 'Popover',
    'options.color.popoverForeground': 'Popover text',
    'options.color.primary': 'Primary background',
    'options.color.primaryForeground': 'Primary text',
    'options.color.ring': 'Ring',
    'options.color.secondary': 'Secondary background',
    'options.color.secondaryForeground': 'Secondary text',
    'options.color.sidebar': 'Sidebar background',
    'options.color.sidebarAccent': 'Sidebar accent background',
    'options.color.sidebarAccentForeground': 'Sidebar accent text',
    'options.color.sidebarBorder': 'Sidebar border',
    'options.color.sidebarForeground': 'Sidebar text',
    'options.color.sidebarPrimary': 'Sidebar primary background',
    'options.color.sidebarPrimaryForeground': 'Sidebar primary text',
    'options.color.sidebarRing': 'Sidebar ring',
    'options.color.hexPlaceholder': 'e.g. #FF5733, #3366CC',
    'options.color.resetError': 'Failed to reset color settings',
    'options.color.resetSuccess': 'Reset color settings',
    'options.contact': 'Contact',
    'options.contactDescription':
      'Google Forms is used. A Google account is required because image uploads are enabled.',
    'options.fontSize.currentValue': 'Current value: {{value}}%',
    'options.fontSize.description':
      'Adjust the font size used across the extension.',
    'options.fontSize.inputLabel': 'Font size percentage',
    'options.fontSize.rangeLabel': 'Font size slider',
    'options.excludePatterns.add': 'Add',
    'options.excludePatterns.empty': 'No exclude patterns',
    'options.excludePatterns.help':
      'Matching URLs are not saved and tabs are not closed.',
    'options.excludePatterns.label': 'URLs that should not be saved or closed',
    'options.excludePatterns.placeholder': 'e.g. chrome-extension://',
    'options.excludePatterns.removeAria': 'Remove exclude pattern {{pattern}}',
    'options.excludePatterns.title': 'Exclude settings',
    'options.importExport.cancel': 'Cancel',
    'options.importExport.placeholderUrlTitle':
      'Recovered data (missing original URL)',
    'options.importExport.dialogDescription':
      'Restore settings and tab data from a previously exported backup file.',
    'options.importExport.dialogTitle': 'Import settings and tab data',
    'options.importExport.dropActive': 'Drop the file here',
    'options.importExport.dropIdle': 'Drag and drop a JSON file',
    'options.importExport.export': 'Export settings and tab data',
    'options.importExport.exporting': 'Exporting...',
    'options.importExport.exportError':
      'An error occurred while exporting settings and tab data',
    'options.importExport.exportSuccess':
      'Exported settings and tab data successfully',
    'options.importExport.import': 'Import settings and tab data',
    'options.importExport.importError':
      'Failed to import settings and tab data',
    'options.importExport.importFormatError':
      'The imported data format is invalid',
    'options.importExport.importing': 'Importing...',
    'options.importExport.invalidJson': 'Please select a JSON file',
    'options.importExport.merge': 'Merge with existing data (recommended)',
    'options.importExport.mergeDescription':
      'Keep existing data and add or update new data.',
    'options.importExport.mergeLabel': 'Note',
    'options.importExport.mergeWarning':
      'When merging, data with the same ID is updated.',
    'options.importExport.mergeSuccess':
      'Merged data (added {{categories}} categories and {{domains}} domains){{unresolved}}',
    'options.importExport.replaceDescription':
      'Importing will overwrite all current settings and tab data. This cannot be undone.',
    'options.importExport.replaceLabel': 'Warning',
    'options.importExport.replaceWarning':
      'Importing will overwrite all current settings and tab data. This cannot be undone.',
    'options.importExport.replaceSuccess':
      'Replaced settings and tab data (version: {{version}}, created at: {{timestamp}}){{unresolved}}',
    'options.importExport.readError': 'Failed to read the file',
    'options.importExport.selectFile': 'Click to choose a file',
    'options.importExport.unresolvedWarning':
      ' (Warning: {{count}} domains were missing URL records, so {{placeholderCount}} replacement URLs were generated)',
    'options.importExport.uploadTitle': 'Import settings and tab data',
    'options.categories.validation.maxLength':
      'Category names must be 25 characters or fewer',
    'options.categories.duplicate':
      'A category with the same name already exists.',
    'options.categories.addError': 'Could not add the category.',
    'options.previewColorCustomization': '(preview) Color customization',
    'options.previewColorCustomizationReset': 'Reset',
    'options.previewFontSizeCustomization': '(preview) Font size',
    'options.releaseNotes': 'Release Notes',
    'options.showSavedTime': 'Show saved time',
    'options.showSavedTimeDescription':
      'When enabled, the saved date is shown in the saved tabs list.',
    'options.title': 'Options',
    'periodicExecution.title': 'Scheduled tasks',
    'savedTabs.addProject': 'Add project',
    'savedTabs.categoryModal.allCategorized':
      'All domains are already categorized',
    'savedTabs.categoryModal.belongsToCategory': 'Assigned category: {{name}}',
    'savedTabs.categoryModal.createError': 'Could not create the category',
    'savedTabs.categoryModal.createLabel': 'New parent category',
    'savedTabs.categoryModal.created': 'Created the category',
    'savedTabs.categoryModal.currentCategory':
      'Currently selected category: {{name}}',
    'savedTabs.categoryModal.deleteConfirmDescription':
      'Delete the parent category "{{name}}"? This action cannot be undone.',
    'savedTabs.categoryModal.deleteConfirmDomains':
      '{{count}} domains are assigned to this category. Deleting it also removes those assignments.',
    'savedTabs.categoryModal.deleteError': 'Could not delete the category',
    'savedTabs.categoryModal.deleteSelectionMissing':
      'No category is selected for deletion',
    'savedTabs.categoryModal.deleteSelected':
      'Delete the selected parent category',
    'savedTabs.categoryModal.deleted': 'Deleted "{{name}}"',
    'savedTabs.categoryModal.duplicateName':
      'A category named "{{name}}" already exists',
    'savedTabs.categoryModal.domainAssigned':
      'Added domain {{domain}} to "{{categoryName}}"',
    'savedTabs.categoryModal.domainRemoved':
      'Removed domain {{domain}} from "{{categoryName}}"',
    'savedTabs.categoryModal.domainsLabel': 'Domain selection',
    'savedTabs.categoryModal.domainsLabelUncategorized':
      'Domain selection (showing only unassigned domains)',
    'savedTabs.categoryModal.invalid': 'The category name is invalid',
    'savedTabs.categoryModal.loadError': 'Could not load the categories',
    'savedTabs.categoryModal.noDomains': 'There are no saved domains',
    'savedTabs.categoryModal.placeholder': 'e.g. Work, Hobby, Learning',
    'savedTabs.categoryModal.selectLabel': 'Select parent category',
    'savedTabs.categoryModal.selectPlaceholder':
      'Select a created category to manage domains',
    'savedTabs.categoryModal.title': 'Manage parent categories',
    'savedTabs.categoryModal.toggleError':
      'Could not update the category assignment',
    'savedTabs.categoryModal.uncategorized': 'Uncategorized',
    'savedTabs.categoryModal.uncategorizedAria': 'Uncategorized domain',
    'savedTabs.categoryModal.uncategorizedDirectEditError':
      'You cannot edit the uncategorized view directly. Select a category first.',
    'savedTabs.categoryModal.validation.empty':
      'Enter a new parent category name',
    'savedTabs.categoryModal.validation.maxLength':
      'Parent category names must be within 25 characters.',
    'savedTabs.customProjects.emptyDescription':
      'No projects are available to display',
    'savedTabs.customProjects.emptyHint':
      'Create a parent category to show it as a project',
    'savedTabs.customProjects.emptyTitle': 'No projects',
    'savedTabs.customProjects.createAction': 'Create',
    'savedTabs.customProjects.createDialogTitle': 'Create a new project',
    'savedTabs.customProjects.createPlaceholder':
      'e.g. Website redesign, Library research',
    'savedTabs.customProjects.nameLabel': 'Project name *',
    'savedTabs.category.deleteAllItemName': 'domains in this category',
    'savedTabs.category.deleteAllWarning':
      'Delete all domains in this category. This action cannot be undone.',
    'savedTabs.categoryManagement.addDomainLabel': 'Add a new domain',
    'savedTabs.categoryManagement.addDomainPlaceholder':
      'Select a domain to add to the category',
    'savedTabs.categoryManagement.addDomainTooltip':
      'Add the selected domain to this parent category',
    'savedTabs.categoryManagement.deleteAction': 'Delete parent category',
    'savedTabs.categoryManagement.deleteConfirmDescription':
      'Delete the parent category "{{name}}"? This action cannot be undone.',
    'savedTabs.categoryManagement.deleteConfirmDomains':
      'This category is linked to {{count}} domains. Deleting it also removes those associations.',
    'savedTabs.categoryManagement.nameLabel': 'Parent category name',
    'savedTabs.categoryManagement.noAvailableDomains':
      'There are no domains you can add.',
    'savedTabs.categoryManagement.registeredDomainsEmpty':
      'No registered domains',
    'savedTabs.categoryManagement.registeredDomainsLabel': 'Registered domains',
    'savedTabs.categoryManagement.renameError':
      'Failed to rename the parent category',
    'savedTabs.categoryManagement.removeDomainAria': 'Delete domain',
    'savedTabs.categoryManagement.renameAction': 'Rename parent category',
    'savedTabs.categoryManagement.renamePlaceholder':
      'e.g. Business tools, Tech information',
    'savedTabs.categoryManagement.renamePrompt':
      'Enter a new parent category name for "{{name}}"',
    'savedTabs.categoryManagement.renamed':
      'Renamed the parent category from "{{before}}" to "{{after}}"',
    'savedTabs.categoryManagement.reorderCanceled':
      'Canceled parent category reordering',
    'savedTabs.categoryManagement.reorderUpdated':
      'Updated the parent category order',
    'savedTabs.categoryManagement.reorderUpdateError':
      'Failed to update the parent category order',
    'savedTabs.categoryManagement.title': 'Manage parent category "{{name}}"',
    'savedTabs.collapse': 'Collapse',
    'savedTabs.domainOrder.updated': 'Updated the domain order',
    'savedTabs.domainOrder.updateError': 'Failed to update the domain order',
    'savedTabs.domainOrder.canceled': 'Canceled reordering',
    'savedTabs.domain.deleteAllWarning':
      'Delete all tabs in this domain. This action cannot be undone.',
    'savedTabs.deleteAll': 'Delete all',
    'savedTabs.deleteAllDefaultWarning':
      'Delete all items. This action cannot be undone.',
    'savedTabs.deleteAllTitle': 'Delete all {{itemName}}?',
    'savedTabs.domain.emptyManageCategoriesHint':
      'To add categories, use category management.',
    'savedTabs.domain.emptyNoTabs': 'This domain has no tabs',
    'savedTabs.emptyDescription':
      'Right-click a tab to save it, or click the extension icon.',
    'savedTabs.emptyTitle': 'No saved tabs',
    'savedTabs.expand': 'Expand',
    'savedTabs.deleteAllConfirmDescription':
      'Delete all tabs in "{{categoryName}}". This action cannot be undone.',
    'savedTabs.deleteAllConfirmTitle': 'Delete all tabs?',
    'savedTabs.deleteAllTabs': 'Delete all tabs',
    'savedTabs.deletingAll': 'Deleting...',
    'savedTabs.domainsCount': 'Domains:{{count}}',
    'savedTabs.keywords.activeCategoryLabel':
      'Keywords for the "{{name}}" subcategory',
    'savedTabs.keywords.addAria': 'Add keyword',
    'savedTabs.keywords.autoAssignHint':
      'If the title contains a keyword, it is automatically assigned to this subcategory.',
    'savedTabs.keywords.duplicate': 'This keyword has already been added',
    'savedTabs.keywords.deleteAria': 'Delete keyword',
    'savedTabs.keywords.deleteAriaWithName': 'Delete keyword {{name}}',
    'savedTabs.keywords.empty': 'No keywords',
    'savedTabs.keywords.placeholder': 'e.g. Tech, New features, Tutorial',
    'savedTabs.keywordModal.title': 'Manage subcategories for "{{domain}}"',
    'savedTabs.manageParentCategories': 'Manage parent categories',
    'savedTabs.manageSubcategories': 'Manage subcategories',
    'savedTabs.newProjectPlaceholder': 'e.g. Work, Research, Read later',
    'savedTabs.newProjectTitle': 'Add a new project',
    'savedTabs.openAll': 'Open all',
    'savedTabs.openAllConfirmDescription':
      'You are about to open {{count}} or more tabs. Continue?',
    'savedTabs.openAllConfirmTitle': 'Open all tabs?',
    'savedTabs.openAllTabs': 'Open all tabs',
    'savedTabs.projectAdded': 'Added project "{{name}}"',
    'savedTabs.projectCard.dropToUncategorized':
      'Drop tabs here to move them to uncategorized',
    'savedTabs.projectCard.uncategorizedArea': 'Uncategorized tabs area',
    'savedTabs.projectCard.uncategorizedTitle': 'Uncategorized tabs',
    'savedTabs.project.deleteAllItemName': 'tabs in this project',
    'savedTabs.project.deleteAllWarning':
      'Delete all tabs in this project. This action cannot be undone.',
    'savedTabs.projectManagement.autoAssignDescription':
      'Applies to newly saved tabs.',
    'savedTabs.projectManagement.autoAssignLabel': 'Auto-assignment keywords',
    'savedTabs.projectManagement.deleteAction': 'Delete project',
    'savedTabs.projectManagement.deleteConfirmDescription':
      'Delete the project "{{name}}"? This action cannot be undone.',
    'savedTabs.projectManagement.deleteConfirmHint':
      'All tab associations in this project will also be removed.',
    'savedTabs.projectManagement.keywordDomainDescription':
      'If the domain contains a keyword, assign it to this project.',
    'savedTabs.projectManagement.keywordDomainLabel': 'Domain keywords',
    'savedTabs.projectManagement.keywordDomainPlaceholder': 'e.g. github.com',
    'savedTabs.projectManagement.keywordTitleDescription':
      'If the title contains a keyword, assign it to this project.',
    'savedTabs.projectManagement.keywordTitleLabel': 'Title keywords',
    'savedTabs.projectManagement.keywordTitlePlaceholder': 'e.g. release',
    'savedTabs.projectManagement.keywordUrlDescription':
      'If the URL contains a keyword, assign it to this project.',
    'savedTabs.projectManagement.keywordUrlLabel': 'URL keywords',
    'savedTabs.projectManagement.keywordUrlPlaceholder': 'e.g. docs',
    'savedTabs.projectManagement.nameLabel': 'Project name',
    'savedTabs.projectManagement.renameError': 'Failed to rename the project',
    'savedTabs.projectManagement.renamed': 'Renamed the project',
    'savedTabs.projectManagement.renameAction': 'Rename',
    'savedTabs.projectManagement.renamePlaceholder': 'e.g. Website redesign',
    'savedTabs.projectManagement.renamePrompt': 'Enter a new project name',
    'savedTabs.projectManagement.title': 'Settings for "{{name}}"',
    'savedTabs.project.emptyDescription':
      'Save tabs from the extension icon or add them from the context menu.',
    'savedTabs.project.emptyDragHint':
      'You can also drag and drop tabs from other projects.',
    'savedTabs.project.emptyTitle': 'This project has no tabs.',
    'savedTabs.project.loadingTabs': 'Loading tabs...',
    'savedTabs.projectCategory.deleteAllWarning':
      'Delete all tabs in "{{categoryName}}". This action cannot be undone.',
    'savedTabs.projectCategory.deleteAction': 'Delete category',
    'savedTabs.projectCategory.deleteWarning':
      'Deleting this category makes all tabs in it uncategorized.',
    'savedTabs.projectCategory.added': 'Added category "{{name}}"',
    'savedTabs.projectCategory.deleted': 'Deleted category "{{name}}"',
    'savedTabs.projectCategory.manage': 'Manage category',
    'savedTabs.projectCategory.orderUpdated': 'Updated the category order',
    'savedTabs.projectCategory.orderUpdateError':
      'Failed to update the category order',
    'savedTabs.projectCategory.renameDescription':
      'You can edit the category "{{name}}".',
    'savedTabs.projectCategory.renameLabel': 'Category name',
    'savedTabs.projectCategory.renamePlaceholder':
      'e.g. Development resources, Reference sites',
    'savedTabs.projectCategory.required': 'Enter a category name',
    'savedTabs.categoryCardAria': 'Category: {{name}}',
    'savedTabs.categoryGroupAria': '{{name}} category group',
    'savedTabs.projectCategory.renamed': 'Renamed the category',
    'savedTabs.projectCategory.title': 'Manage category',
    'savedTabs.projects.createError': 'Failed to create the project',
    'savedTabs.projects.deleted': 'Deleted project "{{name}}"',
    'savedTabs.projects.deleteError': 'Failed to delete the project',
    'savedTabs.projects.duplicateName':
      'The project name "{{name}}" is already in use',
    'savedTabs.projects.keywordsUpdated': 'Updated keyword settings',
    'savedTabs.projects.keywordsUpdateError':
      'Failed to update keyword settings',
    'savedTabs.projects.orderUpdated': 'Updated the project order',
    'savedTabs.projects.orderUpdateError': 'Failed to update the project order',
    'savedTabs.projectNameDuplicate':
      'You cannot add a project with the same name',
    'savedTabs.projectNameMaxLength':
      'Project names must be 50 characters or fewer',
    'savedTabs.projectNameRequired': 'Enter a project name',
    'savedTabs.projectsCount': 'Projects:{{count}}',
    'savedTabs.reorder.disabled': 'Reorder mode active',
    'savedTabs.reorder.cancel': 'Cancel',
    'savedTabs.reorder.cancelAria': 'Cancel parent category reordering',
    'savedTabs.reorder.confirm': 'Confirm',
    'savedTabs.reorder.confirmAria': 'Confirm parent category reordering',
    'savedTabs.searchPlaceholder': 'Search',
    'savedTabs.sort.asc': 'Saved date ascending',
    'savedTabs.sort.default': 'Default',
    'savedTabs.sort.desc': 'Saved date descending',
    'savedTabs.sortableCategory.bulkDeleteTitle': 'Delete tabs',
    'savedTabs.sortableCategory.bulkDeleteDescription':
      'Delete all tabs in "{{name}}"?',
    'savedTabs.sortableCategory.bulkOpenTitle': 'Open multiple tabs',
    'savedTabs.sortableCategory.tabCountLabel': 'Tabs',
    'savedTabs.subCategory.deleteSelected': 'Delete the selected subcategory',
    'savedTabs.subCategory.addPlaceholder': 'e.g. News, Blog, Column',
    'savedTabs.subCategory.addTitle': 'Add a new subcategory',
    'savedTabs.subCategory.created': 'Added a new category "{{name}}"',
    'savedTabs.subCategory.createError': 'Failed to add the category',
    'savedTabs.subCategory.deleted': 'Deleted category "{{name}}"',
    'savedTabs.subCategory.deleteConfirmHint':
      'All tabs in this subcategory will become uncategorized.',
    'savedTabs.subCategory.deleteConfirmTitle':
      'Delete the "{{name}}" subcategory?',
    'savedTabs.subCategory.deleteError': 'Failed to delete the category',
    'savedTabs.subCategory.deleteAria': 'Delete category {{name}}',
    'savedTabs.subCategory.duplicateName': 'This category name already exists',
    'savedTabs.subCategory.empty': 'This domain has no subcategories.',
    'savedTabs.subCategory.keywordManagerTitle': 'Manage subcategory keywords',
    'savedTabs.subCategory.renameHint':
      'Press Enter to save, or Escape to cancel',
    'savedTabs.subCategory.renamePrompt':
      'Enter a new name for "{{name}}". After typing, blur or press Enter to save. Press Escape to cancel.',
    'savedTabs.subCategory.renamed':
      'Renamed the category from "{{before}}" to "{{after}}"',
    'savedTabs.subCategory.renameError': 'Failed to rename the category',
    'savedTabs.subCategory.rename': 'Rename subcategory',
    'savedTabs.subCategory.reorderUpdated': 'Updated the subcategory order',
    'savedTabs.subCategory.reorderUpdateError':
      'Failed to update the subcategory order',
    'savedTabs.subCategory.reorderCanceled': 'Canceled subcategory reordering',
    'savedTabs.subCategory.selectLabel': 'Select subcategory',
    'savedTabs.subCategory.selectPlaceholder': 'Select a subcategory to manage',
    'savedTabs.subCategory.titleKeywords': 'Keywords for "{{name}}"',
    'savedTabs.tab.added': 'Added the tab',
    'savedTabs.tab.addError': 'Failed to add the tab',
    'savedTabs.tab.categoryClearedAlt': 'Cleared the tab category (Alt+click)',
    'savedTabs.tab.deleteError': 'Failed to delete the tab',
    'savedTabs.tab.deleted': 'Deleted the tab',
    'savedTabs.tab.moveError': 'Failed to update the tab category',
    'savedTabs.tab.movedBetweenProjects': 'Moved the tab',
    'savedTabs.tab.moveBetweenProjectsError': 'Failed to move the tab',
    'savedTabs.tab.movedToCategory': 'Moved the tab to "{{name}}"',
    'savedTabs.tab.movedToUncategorized': 'Moved the tab to uncategorized',
    'savedTabs.tab.orderUpdated': 'Updated the tab order',
    'savedTabs.tab.orderUpdateError': 'Failed to update the tab order',
    'savedTabs.tabs.deletedCount': 'Deleted {{count}} tabs',
    'savedTabs.tabCount': 'Tabs:{{count}}',
    'savedTabs.uncategorized': 'Uncategorized',
    'savedTabs.uncategorizedDomainsTitle': 'Uncategorized domains',
    'savedTabs.url.deleteAria': 'Delete tab',
    'savedTabs.url.deleteConfirmDescription':
      'Delete this tab. This action cannot be undone.',
    'savedTabs.url.deleteConfirmTitle': 'Delete this tab?',
    'savedTabs.viewMode.changeError': 'Failed to switch the view mode',
    'savedTabs.viewMode.custom': 'Custom mode',
    'savedTabs.viewMode.domain': 'Domain mode',
    'savedTabs.viewMode.placeholder': 'View mode',
    'savedTabs.viewMode.selectPlaceholder': 'Select domain or custom mode',
    'savedTabs.viewMode.tooltip': 'Switch view mode',
    'sidebar.analytics': 'Analytics',
    'sidebar.chat': 'Chat',
    'sidebar.collapse': 'Collapse sidebar',
    'sidebar.open': 'Open sidebar',
    'sidebar.resize': 'Resize sidebar width',
    'tool.status.approvalRequested': 'Awaiting Approval',
    'tool.status.approvalResponded': 'Responded',
    'tool.status.inputAvailable': 'Running',
    'tool.status.inputStreaming': 'Pending',
    'tool.status.outputAvailable': 'Completed',
    'tool.status.outputDenied': 'Denied',
    'tool.status.outputError': 'Error',
    'background.contextMenu.openSavedTabs': 'Open saved tabs',
    'background.contextMenu.saveCurrentTab': 'Save current tab',
    'background.contextMenu.saveAllTabs': 'Save all tabs in this window',
    'background.contextMenu.saveSameDomainTabs':
      'Save all tabs from the current domain',
    'background.contextMenu.saveAllWindowsTabs':
      'Save all tabs across all windows',
    'background.saveTabs.notificationTitle': 'Tab saved',
    'background.saveTabs.currentTabSaved': 'Saved the current tab.',
    'background.saveTabs.sameDomainSaved':
      'Saved {{count}} tabs from {{domain}}.',
    'background.saveTabs.allWindowsSaved':
      'Saved {{count}} tabs across all windows.',
    'background.saveTabs.windowTabsSaved':
      'Saved {{count}} tabs. Closing the tabs now.',
    'sidebar.options': 'Options',
    'sidebar.periodicExecution': 'Scheduled tasks',
    'sidebar.tabList': 'Saved tabs',
  },
  ja: {
    'aiChat.deleteConversationAria': '{{title}}を削除',
    'aiChat.deleteDescription': '削除すると元に戻せません。',
    'aiChat.deleteTitle': 'この会話を削除しますか？',
    'aiChat.historyHint': 'クリックして続きを開く',
    'aiChat.historyTitle': '最近の会話',
    'aiChat.open': 'AIチャットを開く',
    'aiChat.close': 'AIチャットを閉じる',
    'aiChat.chatTitle': 'チャット',
    'aiChat.sidebarAria': 'AIチャットサイドバー',
    'aiChat.pageAria': 'AIチャット画面',
    'aiChat.resizeAria': 'AIチャットの幅を調整',
    'aiChat.scrollLatest': '最新メッセージへ移動',
    'aiChat.send': '送信',
    'aiChat.sending': '送信中...',
    'aiChat.inputLabel': 'AIに質問する',
    'aiChat.inputPlaceholder': '保存済みタブについて質問してください',
    'aiChat.inputPlaceholderSelectModel':
      '左下で Ollama モデルを選択してください',
    'aiChat.emptySelectModel': 'モデルを選択してください',
    'aiChat.intro': '保存済みタブを質問できます。',
    'aiChat.suggestion.recentTabs': '今月追加したタブを教えて',
    'aiChat.suggestion.favoriteContent': '最近よく保存しているジャンルは？',
    'aiChat.suggestion.recommendation': 'どんなコンテンツが好きそうか教えて',
    'aiChat.sources.one': '参照ソース {{count}}件',
    'aiChat.sources.other': '参照ソース {{count}}件',
    'aiChat.shimmer': '回答を組み立てています...',
    'aiChat.reasoning': '推論',
    'aiChat.toolsRun': '実行ツール',
    'aiChat.copyConversation': '会話をコピー',
    'aiChat.copyConversationSuccess': '会話をコピーしました',
    'aiChat.copyConversationError': '会話をコピーできませんでした',
    'aiChat.newConversation': '新しい会話',
    'aiChat.attachments.add': 'ファイルを添付',
    'aiChat.attachments.deleteAria': '{{filename}}を削除',
    'aiChat.attachments.defaultName': '添付ファイル',
    'aiChat.attachments.unsupportedType':
      'テキストファイルと画像ファイルのみ対応しています。',
    'aiChat.attachments.unsupportedTypeDetail':
      '{{filename}} は現在の AI チャットで扱えません ({{mediaType}})。',
    'aiChat.attachments.maxFileSize':
      '添付ファイルは 2 MB 以下にしてください。',
    'aiChat.attachments.maxFiles':
      '添付できるファイルは最大 {{count}} 件です。',
    'aiChat.attachments.readError': '添付ファイルを読み取れませんでした。',
    'aiChat.streaming.receivedQuestion': '- 質問を受け取りました: {{prompt}}',
    'aiChat.streaming.checkingTabs': '- 保存済みタブを確認しています。',
    'aiChat.streaming.toolsFollow':
      '- ステップ完了ごとにツール実行結果と推論を更新します。',
    'aiChat.copy.user': 'ユーザー:',
    'aiChat.copy.assistant': 'AI:',
    'aiChat.copy.attachments': '添付:',
    'aiChat.systemPrompt.select': 'システムプロンプトを選択',
    'aiChat.systemPrompt.placeholder': 'プロンプト',
    'aiChat.systemPrompt.empty': '利用可能なシステムプロンプトがありません',
    'aiChat.systemPrompt.managerTitle': 'システムプロンプト管理',
    'aiChat.systemPrompt.listTitle': 'システムプロンプト',
    'aiChat.systemPrompt.inUse': '使用中',
    'aiChat.systemPrompt.new': '新規作成',
    'aiChat.systemPrompt.nameLabel': 'プロンプト名',
    'aiChat.systemPrompt.bodyLabel': 'システムプロンプト本文',
    'aiChat.systemPrompt.duplicate': '複製',
    'aiChat.systemPrompt.availableTools': '利用できるツール',
    'aiChat.systemPrompt.availableToolsDescription':
      'システムプロンプトに含めやすいよう、ツール名と説明を一覧表示しています。',
    'aiChat.systemPrompt.validation.empty':
      'プロンプト名とシステムプロンプト本文を入力してください。',
    'aiChat.systemPrompt.validation.maxLength':
      'プロンプト名は {{count}} 文字以内で入力してください。',
    'aiChat.systemPrompt.validation.duplicate':
      '同じ名前のプロンプトは保存できません。',
    'aiChat.systemPrompt.saving': '保存中...',
    'aiChat.systemPrompt.save': '保存',
    'aiChat.systemPrompt.saveError': 'システムプロンプトを保存できませんでした',
    'aiChat.systemPrompt.switchSaveError':
      'システムプロンプトの切り替えを保存できませんでした',
    'aiChat.systemPrompt.openSettings': 'システムプロンプト設定を開く',
    'aiChat.systemPrompt.settingsTooltip': 'システムプロンプト設定',
    'aiChat.systemPrompt.copySuffix': ' のコピー',
    'aiChat.responseError': 'AI からの応答を取得できませんでした。',
    'aiChat.interruptedResponse':
      '前回の応答は途中で中断されました。必要であれば、もう一度送信してください。',
    'aiChat.modelListLoadError': 'モデル一覧を取得できませんでした',
    'aiChat.modelSettingsSaveError': 'モデル設定を保存できませんでした',
    'aiChat.history.resumeHint': '保存済みの会話から再開できます',
    'aiChat.history.empty': 'まだ保存された会話はありません',
    'aiChat.history.startPrompt': '新しい会話を始めてください',
    'aiChat.ollama.loadModels': 'モデル一覧を取得',
    'aiChat.ollama.loading': '読み込み中...',
    'aiChat.ollama.loadingModelList': 'モデル一覧を読み込み中...',
    'aiChat.ollama.noModelsFound': 'モデルが見つかりません',
    'aiChat.ollama.selectModel': 'モデルを選択',
    'aiChat.ollama.copy': 'コピー',
    'aiChat.ollama.copied': 'コピーしました',
    'aiChat.ollama.copyCommand': 'コマンドをコピー',
    'aiChat.ollama.copyValue': '入力値をコピー',
    'aiChat.ollama.copyCheckCommand': '確認コマンドをコピー',
    'aiChat.ollama.copyError': '{{label}}をコピーできませんでした',
    'aiChat.ollama.copySuccess': '{{label}}をコピーしました',
    'aiChat.ollama.connectionError': 'Ollama に接続できませんでした。',
    'aiChat.ollama.forbiddenError':
      'Ollama が拡張機能からのアクセスを拒否しました (403 Forbidden)。',
    'aiChat.ollama.notInstalledDownload':
      'まだ Ollama をインストールしていない場合は、先にダウンロードしてください。',
    'aiChat.ollama.notInstalledStart':
      'すでにインストール済みなら、Ollama を起動してください。',
    'aiChat.ollama.setOrigins': '次の値で OLLAMA_ORIGINS を設定してください。',
    'aiChat.ollama.connectionUrl': '接続先 URL:',
    'aiChat.ollama.tagsUrl': 'Tags URL:',
    'aiChat.ollama.checkCommand':
      '確認コマンドをコピーして貼り付けると状態を確認できます。',
    'aiChat.ollama.downloadUrl': 'ダウンロード URL:',
    'aiChat.ollama.faq': 'FAQ:',
    'aiChat.ollama.mac.step1':
      'Spotlight 検索で「ターミナル」と入力して開きます。',
    'aiChat.ollama.mac.step2': '次のコマンドをコピーして貼り付けます。',
    'aiChat.ollama.mac.step3': 'return キーを押します。',
    'aiChat.ollama.mac.step4': 'Ollama.app を終了します。',
    'aiChat.ollama.mac.step5': 'Ollama.app を起動し直します。',
    'aiChat.ollama.win.step1':
      'Windows のスタートメニューで「環境変数」と入力します。',
    'aiChat.ollama.win.step2': '「システム環境変数の編集」を開きます。',
    'aiChat.ollama.win.step3': '表示された画面で「環境変数」を押します。',
    'aiChat.ollama.win.step4': '「ユーザー環境変数」の「新規」を押します。',
    'aiChat.ollama.win.step5': '変数名に OLLAMA_ORIGINS を入力します。',
    'aiChat.ollama.win.step6': '変数値に次の値を入力します。',
    'aiChat.ollama.win.step7': '保存してから Ollama を再起動します。',
    'aiChat.ollama.unknown.step1':
      'OLLAMA_ORIGINS を設定してから Ollama を再起動してください。',
    'aiChat.ollama.unknown.step2': '設定する値は以下です。',
    'background.aiChat.ollama.macTitle': 'macOS で Ollama.app を使う場合:',
    'background.aiChat.ollama.setOriginsValue':
      'OLLAMA_ORIGINS に {{value}} を設定してください。',
    'background.aiChat.savedTabsCount': '保存済みタブ {{count}} 件',
    'background.aiChat.recentTabs': '最近保存したタブ一覧:',
    'background.aiChat.intent.list': '保存済みタブの一覧確認',
    'background.aiChat.intent.interests': '保存傾向の推定',
    'background.aiChat.intent.time': '期間や追加時期の確認',
    'background.aiChat.intent.search': '保存済みタブの検索と要約',
    'background.aiChat.toolSummary.fetchedWithTotal':
      '{{count}} 件を取得しました。総件数は {{total}} 件です。',
    'background.aiChat.toolSummary.fetchedCount':
      '{{count}} 件の結果を確認しました。',
    'background.aiChat.toolSummary.resultRetrieved': '結果を取得しました。',
    'background.aiChat.toolSummary.callReviewed':
      '呼び出し内容を確認しました。',
    'background.aiChat.reasoning.intentLabel': '質問の解釈:',
    'background.aiChat.reasoning.referenceLabel': '参照対象:',
    'background.aiChat.reasoning.toolsLabel': '使用ツール:',
    'background.aiChat.reasoning.policyLabel': '回答方針:',
    'background.aiChat.reasoning.policyWithTools':
      'ツール結果を保存済みタブの根拠として使って回答しました。',
    'background.aiChat.reasoning.policyWithoutTools':
      '保存済みタブの要約コンテキストを直接参照して回答しました。',
    'background.aiChat.none': 'なし',
    'aiChat.systemPrompt.defaultName': 'デフォルト',
    'aiChat.systemPrompt.defaultTemplate':
      'あなたは TABBIN に保存されたタブの情報だけを根拠に答えるアシスタントです。\n保存データにない事実は推測しないでください。\n推測が含まれる場合は「保存傾向から見ると」と明示してください。\n月や期間に関する質問では、できるだけ具体的な年月を答えてください。\n現在どんなタブが保存されているかを聞かれたら、まず listSavedUrls を使って確認してください。\n保存済みタブが存在しないとは、tools の結果または保存済みタブ要約が空の場合にだけ答えてください。\n返答は日本語で簡潔にしてください。',
    'aiChat.attachments.contextTitle': '添付ファイルの内容:',
    'aiChat.interests.savedCountLabel': '保存数',
    'aiChat.interests.categoryShareDescription': '最近保存したカテゴリ比率',
    'aiChat.interests.topCategoriesTitle': 'よく保存しているジャンル',
    'aiChat.interests.categoryCountDescription': '最近保存したカテゴリ件数',
    'aiChat.interests.categoryCountTitle': 'ジャンル別の保存数',
    'aiChat.interests.domainCountDescription': '最近保存したドメイン件数',
    'aiChat.interests.topDomainsTitle': 'よく保存しているドメイン',
    'aiChat.interests.noDataSummary':
      'まだ保存データがないため、興味の傾向は判断できません。',
    'aiChat.interests.tentativeSummary':
      '保存件数が少なく判断材料が限られるため、まだ強い傾向は読み取りにくいです。',
    'aiChat.interests.categoryBias':
      'カテゴリでは {{categories}} が目立ちます。',
    'aiChat.interests.categoryWeak': 'カテゴリ偏りはまだ弱めです。',
    'aiChat.interests.summary':
      '保存傾向から見ると {{domainSummary}} 周辺への関心が強く、{{categorySummary}}',
    'analytics.groupBy.domain': 'ドメイン',
    'analytics.groupBy.timeRecent': '時系列（直近）',
    'analytics.groupBy.timeTop': '時系列（件数）',
    'analytics.groupBy.parentCategory': '親カテゴリ',
    'analytics.groupBy.subCategory': '子カテゴリ',
    'analytics.groupBy.project': 'プロジェクト',
    'analytics.chartType.bar': '棒グラフ',
    'analytics.chartType.line': '折れ線',
    'analytics.chartType.area': '面グラフ',
    'analytics.chartType.pie': '円グラフ',
    'analytics.chartType.radar': 'レーダー',
    'analytics.uncategorized': '未分類',
    'analytics.aiSummary': 'AI が生成した分析チャートです。',
    'analytics.conditionsTitle': '分析条件',
    'analytics.viewName': 'ビュー名',
    'analytics.groupByLabel': '集計軸',
    'analytics.chartTypeLabel': 'グラフ種別',
    'analytics.limitLabel': '上位件数',
    'analytics.saveView': '保存する',
    'analytics.savedViewsTitle': '保存済みビュー',
    'analytics.savedViewsDescription':
      '保存した分析条件をここから再利用できます。',
    'analytics.savedViewsEmpty': 'まだ保存された分析ビューはありません。',
    'analytics.deleteViewAria': '{{name}}を削除',
    'analytics.canvasTitle': '分析キャンバス',
    'analytics.drilldownTitle': '項目に含まれる保存タブ',
    'analytics.drilldownCount': '{{count}}件',
    'analytics.drilldownEmpty': '該当する保存タブはありません。',
    'analytics.open': '開く',
    'analytics.openAria': '{{title}} を開く',
    'analytics.chart.savedCountByDomain': 'ドメインごとの保存数',
    'analytics.chart.savedCountByParentCategory': '親カテゴリごとの保存数',
    'analytics.chart.savedCountBySubCategory': '子カテゴリごとの保存数',
    'analytics.chart.savedCountByProject': 'プロジェクトごとの保存数',
    'analytics.chart.savedCountByProjectCategory':
      'プロジェクトカテゴリごとの保存数',
    'analytics.chart.dailySavedTrend': '日別の保存推移',
    'analytics.chart.weeklySavedTrend': '週別の保存推移',
    'analytics.chart.monthlySavedTrend': '月別の保存推移',
    'analytics.chart.descriptionAggregated': '{{count}} 件の保存データを集計',
    'analytics.chart.descriptionCompareMode':
      '{{count}} 件の保存データをモード別に比較',
    'analytics.chart.seriesSavedCount': '保存数',
    'analytics.chart.seriesShare': '割合',
    'analytics.chart.seriesDomainMode': 'ドメイン保存',
    'analytics.chart.seriesCustomMode': 'カスタム保存',
    'analytics.summary':
      '{{count}} 件の保存データから「{{title}}」を作成しました。',
    'common.cancel': 'キャンセル',
    'common.close': '閉じる',
    'common.confirm': '確定',
    'common.console': 'コンソール',
    'common.copy': 'コピー',
    'common.enterUrl': 'URLを入力...',
    'common.delete': '削除',
    'common.input': '入力',
    'common.instructions': '手順',
    'common.output': '出力',
    'common.next': '次へ',
    'common.reasoning': '推論',
    'common.cache': 'キャッシュ',
    'common.loading': '読み込み中...',
    'common.loadingLabel': '読み込み中',
    'common.manage': '管理',
    'common.modelContextUsage': 'モデルのコンテキスト使用量',
    'common.nextBranch': '次の分岐',
    'common.nextSlide': '次のスライド',
    'common.noConsoleOutput': 'コンソール出力はありません',
    'common.noDescription': '説明はありません',
    'common.noStackFrames': 'スタックフレームはありません',
    'common.open': '開く',
    'common.parameters': 'パラメーター',
    'common.pausePreview': 'プレビュー停止',
    'common.previousBranch': '前の分岐',
    'common.previousSlide': '前のスライド',
    'common.previous': '前へ',
    'common.preview': 'プレビュー',
    'common.playPreview': 'プレビュー再生',
    'common.reset': 'リセット',
    'common.requestBody': 'リクエスト本文',
    'common.required': '必須',
    'common.result': '結果',
    'common.response': 'レスポンス',
    'common.searchMicrophones': 'マイクを検索...',
    'common.stop': '停止',
    'common.submit': '送信',
    'common.togglePlan': 'プランを切り替え',
    'common.thinking': '考え中...',
    'common.thoughtForFewSeconds': '数秒考えました',
    'common.thoughtForSeconds': '{{count}} 秒考えました',
    'common.totalCost': '合計コスト',
    'common.tools': 'ツール',
    'common.toggleSidebar': 'サイドバーを切り替え',
    'common.toggleValueVisibility': '値の表示を切り替え',
    'common.uploadFiles': 'ファイルをアップロード',
    'common.usedSources.one': '使用したソース {{count}} 件',
    'common.usedSources.other': '使用したソース {{count}} 件',
    'theme.toggle': 'テーマの切り替え',
    'theme.light': 'ライトモード',
    'theme.dark': 'ダークモード',
    'theme.system': 'システム設定',
    'theme.user': 'ユーザー設定',
    'language.english': 'English',
    'language.japanese': '日本語',
    'language.label': '表示言語',
    'language.system': 'System',
    'changelog.heading': 'リリースノート',
    'htmlTitle.aiChat': 'AIチャット - TABBIN',
    'htmlTitle.app': 'TABBIN',
    'htmlTitle.analytics': '分析 - TABBIN',
    'htmlTitle.changelog': 'リリースノート - TABBIN',
    'htmlTitle.options': 'オプション - TABBIN',
    'htmlTitle.periodicExecution': '定期実行 - TABBIN',
    'htmlTitle.savedTabs': '保存したタブ - TABBIN',
    'options.backupRestore': 'バックアップと復元',
    'options.autoDelete.1day': '1日',
    'options.autoDelete.14days': '14日',
    'options.autoDelete.180days': '6ヶ月',
    'options.autoDelete.1hour': '1時間',
    'options.autoDelete.30days': '30日',
    'options.autoDelete.365days': '1年',
    'options.autoDelete.7days': '7日',
    'options.autoDelete.allWindows': '他のウィンドウを含めすべてのタブを開く',
    'options.autoDelete.allWindowsDescription':
      'オンにすると、「すべて開く」ボタンで新しいウィンドウを作成し、タブを開きます。',
    'options.autoDelete.apply': '設定する',
    'options.autoDelete.background': 'バックグラウンドタブで開く',
    'options.autoDelete.confirmDeleteAll': 'すべて削除前に確認する',
    'options.autoDelete.confirmDeleteAllDescription':
      'オンにすると、カテゴリごとにすべてのタブを削除する前に確認ダイアログを表示します。',
    'options.autoDelete.confirmDeleteEach': 'タブ削除前に確認する',
    'options.autoDelete.confirmDeleteEachDescription':
      'オンにすると、タブを削除する前に確認ダイアログを表示します。',
    'options.autoDelete.confirmMessage':
      '自動削除期間を「{{periodLabel}}」に設定します。\n\n{{warningMessage}}\n\n続行しますか？',
    'options.autoDelete.description':
      '保存されたタブが指定した期間を超えると自動的に削除されます。',
    'options.autoDelete.externalDrop':
      '別ブラウザへドラッグ&ドロップした後、リストから自動的に削除する',
    'options.autoDelete.externalDropDescription':
      'オンにすると、保存したタブを別ブラウザへドラッグ&ドロップした際にリストから削除します。',
    'options.autoDelete.excludePinned': '固定タブ（ピン留め）を除外する',
    'options.autoDelete.excludePinnedDescription':
      'オンにすると、ピン留めされたタブは保存対象から除外されます。',
    'options.autoDelete.enabled':
      '自動削除期間を「{{periodLabel}}」に設定しました',
    'options.autoDelete.disabled': '自動削除を無効にしました',
    'options.autoDelete.openAfter':
      '保存したタブを開いた後、リストから自動的に削除する',
    'options.autoDelete.openAfterDescription':
      'オンにすると、保存したタブを開いた後、そのタブは保存リストから自動的に削除されます。オフにすると、保存したタブを開いても、リストからは削除されません。',
    'options.autoDelete.savedTime': '保存日時を表示する',
    'options.autoDelete.savedTimeDescription':
      'オンにすると、保存タブ一覧に保存された日時が表示されます。',
    'options.autoDelete.saveInBackground': 'バックグラウンドタブで開く',
    'options.autoDelete.saveInBackgroundDescription':
      'オンにすると、保存したタブをバックグラウンドで開きます。',
    'options.autoDelete.periodDescription':
      '保存されたタブが指定した期間を超えると自動的に削除されます。設定を適用すると、その時点で期限切れのタブは削除されます。',
    'options.autoDelete.periodLabel': 'タブの自動削除期間',
    'options.autoDelete.selectPlaceholder': '自動削除期間を選択',
    'options.autoDelete.shorterWarning':
      '警告: 現在よりも短い期間に設定するため、一部のタブがすぐに削除される可能性があります！',
    'options.autoDelete.validateWarning':
      '注意: 設定した期間より古いタブはすぐに削除される可能性があります。',
    'options.autoDelete.saveError': '設定の保存に失敗しました',
    'options.autoDelete.title': '自動削除',
    'options.autoDelete.zero': '自動削除しない',
    'options.behavior.description':
      'オンにすると、すべてのタブを新しいウィンドウで開きます。',
    'options.behaviorSettings': 'タブの挙動設定',
    'options.clickBehavior.allWindows':
      '他のウィンドウを含めすべてのタブを保存',
    'options.clickBehavior.currentTab': '現在のタブを保存',
    'options.clickBehavior.sameDomain':
      '現在開いているドメインのタブをすべて保存',
    'options.clickBehavior.windowTabs': 'ウィンドウのすべてのタブを保存',
    'options.clickBehaviorLabel': '拡張機能ボタンをクリックした時の挙動',
    'options.clickBehaviorPlaceholder': 'クリック時の挙動を選択してください',
    'options.color.accent': 'アクセント背景',
    'options.color.accentForeground': 'アクセントテキスト',
    'options.color.background': '背景',
    'options.color.border': 'ボーダー',
    'options.color.card': 'カード背景',
    'options.color.cardForeground': 'カードテキスト',
    'options.color.chart1': 'チャート1',
    'options.color.chart2': 'チャート2',
    'options.color.chart3': 'チャート3',
    'options.color.chart4': 'チャート4',
    'options.color.chart5': 'チャート5',
    'options.color.destructive': 'デストラクティブ背景',
    'options.color.destructiveForeground': 'デストラクティブテキスト',
    'options.color.foreground': 'テキスト',
    'options.color.input': '入力背景',
    'options.color.muted': '控えめ背景',
    'options.color.mutedForeground': 'サブテキスト',
    'options.color.popover': 'ポップオーバー',
    'options.color.popoverForeground': 'ポップオーバーテキスト',
    'options.color.primary': 'プライマリ背景',
    'options.color.primaryForeground': 'プライマリテキスト',
    'options.color.ring': 'リング',
    'options.color.secondary': 'セカンダリ背景',
    'options.color.secondaryForeground': 'セカンダリテキスト',
    'options.color.sidebar': 'サイドバー背景',
    'options.color.sidebarAccent': 'サイドバー アクセント背景',
    'options.color.sidebarAccentForeground': 'サイドバー アクセントテキスト',
    'options.color.sidebarBorder': 'サイドバー ボーダー',
    'options.color.sidebarForeground': 'サイドバー テキスト',
    'options.color.sidebarPrimary': 'サイドバー プライマリ背景',
    'options.color.sidebarPrimaryForeground': 'サイドバー プライマリテキスト',
    'options.color.sidebarRing': 'サイドバー リング',
    'options.color.hexPlaceholder': '例: #FF5733, #3366CC',
    'options.color.resetError': 'カラー設定のリセットに失敗しました',
    'options.color.resetSuccess': 'カラー設定をリセットしました',
    'options.contact': 'お問い合わせ',
    'options.contactDescription':
      'Google Formsを使用します。※画像アップロード可能な設定ですので、Googleアカウントでのログインが必要です。',
    'options.fontSize.currentValue': '現在の値: {{value}}%',
    'options.fontSize.description':
      '拡張機能全体で使うフォントサイズを調整できます。',
    'options.fontSize.inputLabel': 'フォントサイズ (%)',
    'options.fontSize.rangeLabel': 'フォントサイズスライダー',
    'options.excludePatterns.add': '追加',
    'options.excludePatterns.empty': '除外パターンはありません',
    'options.excludePatterns.help':
      'これらのパターンに一致するURLは保存されず、タブも閉じられません。',
    'options.excludePatterns.label': '保存・閉じない URL パターン',
    'options.excludePatterns.placeholder': '例: chrome-extension://',
    'options.excludePatterns.removeAria': '除外パターン {{pattern}} を削除',
    'options.excludePatterns.title': '除外設定',
    'options.importExport.cancel': 'キャンセル',
    'options.importExport.placeholderUrlTitle': '復元データ（元URL欠損）',
    'options.importExport.dialogDescription':
      '以前にエクスポートしたバックアップファイルから設定とタブデータを復元します。',
    'options.importExport.dialogTitle': '設定とタブデータのインポート',
    'options.importExport.dropActive': 'ファイルをドロップ',
    'options.importExport.dropIdle': 'JSONファイルをドラッグ&ドロップ',
    'options.importExport.export': '設定とタブデータをエクスポート',
    'options.importExport.exporting': 'エクスポート中...',
    'options.importExport.exportError': 'エクスポート中にエラーが発生しました',
    'options.importExport.exportSuccess':
      '設定とタブデータをエクスポートしました',
    'options.importExport.import': '設定とタブデータをインポート',
    'options.importExport.importError': 'インポートに失敗しました',
    'options.importExport.importFormatError':
      'インポートされたデータの形式が正しくありません',
    'options.importExport.importing': 'インポート中...',
    'options.importExport.invalidJson': 'JSONファイルを選択してください',
    'options.importExport.merge': '既存データとマージする（推奨）',
    'options.importExport.mergeDescription':
      '既存のデータを保持しつつ、新しいデータを追加・更新します。',
    'options.importExport.mergeLabel': '注意',
    'options.importExport.mergeWarning':
      'マージの際、同じIDのデータは更新されます。',
    'options.importExport.mergeSuccess':
      'データをマージしました（{{categories}}個のカテゴリと{{domains}}個のドメインを追加）{{unresolved}}',
    'options.importExport.replaceDescription':
      'インポートすると現在の設定とタブデータがすべて上書きされます。この操作は元に戻せません。',
    'options.importExport.replaceLabel': '警告',
    'options.importExport.replaceWarning':
      'インポートすると現在の設定とタブデータがすべて上書きされます。この操作は元に戻せません。',
    'options.importExport.replaceSuccess':
      '設定とタブデータを置き換えました（バージョン: {{version}}、作成日時: {{timestamp}}）{{unresolved}}',
    'options.importExport.readError': 'ファイルの読み込みに失敗しました',
    'options.importExport.selectFile': 'クリックしてファイルを選択',
    'options.importExport.unresolvedWarning':
      '（注意: {{count}}個のドメインでURL実体が欠損していたため、{{placeholderCount}}件の代替URLを生成しました）',
    'options.importExport.uploadTitle': '設定とタブデータのインポート',
    'options.categories.validation.maxLength':
      'カテゴリ名は25文字以下にしてください',
    'options.categories.duplicate': '同じ名前のカテゴリがすでに存在します。',
    'options.categories.addError': 'カテゴリの追加に失敗しました。',
    'options.previewColorCustomization': '(preview)カラーカスタマイズ',
    'options.previewColorCustomizationReset': 'リセット',
    'options.previewFontSizeCustomization': '(preview)フォントサイズ',
    'options.releaseNotes': 'リリースノート',
    'options.showSavedTime': '保存日時を表示する',
    'options.showSavedTimeDescription':
      'オンにすると、保存タブ一覧に保存された日時が表示されます。',
    'options.title': 'オプション',
    'periodicExecution.title': '定期実行',
    'savedTabs.addProject': 'プロジェクト追加',
    'savedTabs.categoryModal.allCategorized':
      'すべてのドメインがカテゴリに分類されています',
    'savedTabs.categoryModal.belongsToCategory': '所属カテゴリ: {{name}}',
    'savedTabs.categoryModal.createError': 'カテゴリの作成に失敗しました',
    'savedTabs.categoryModal.createLabel': '新規親カテゴリ名',
    'savedTabs.categoryModal.created': 'カテゴリを作成しました',
    'savedTabs.categoryModal.currentCategory': '現在選択中のカテゴリ: {{name}}',
    'savedTabs.categoryModal.deleteConfirmDescription':
      '親カテゴリ「{{name}}」を削除しますか？この操作は取り消せません。',
    'savedTabs.categoryModal.deleteConfirmDomains':
      'このカテゴリには {{count}} 件のドメインが関連付けられています。削除すると、ドメインと親カテゴリの関連付けも削除されます。',
    'savedTabs.categoryModal.deleteError': 'カテゴリの削除に失敗しました',
    'savedTabs.categoryModal.deleteSelectionMissing':
      '削除するカテゴリが選択されていません',
    'savedTabs.categoryModal.deleteSelected': '選択中の親カテゴリを削除',
    'savedTabs.categoryModal.deleted': 'カテゴリ「{{name}}」を削除しました',
    'savedTabs.categoryModal.duplicateName':
      'カテゴリ名「{{name}}」は既に存在します',
    'savedTabs.categoryModal.domainAssigned':
      'ドメイン {{domain}} を「{{categoryName}}」に追加しました',
    'savedTabs.categoryModal.domainRemoved':
      'ドメイン {{domain}} を「{{categoryName}}」から削除しました',
    'savedTabs.categoryModal.domainsLabel': 'ドメイン選択',
    'savedTabs.categoryModal.domainsLabelUncategorized':
      'ドメイン選択（未割り当てドメインのみ表示）',
    'savedTabs.categoryModal.invalid': 'カテゴリ名が無効です',
    'savedTabs.categoryModal.loadError': 'カテゴリの読み込みに失敗しました',
    'savedTabs.categoryModal.noDomains': '保存されたドメインがありません',
    'savedTabs.categoryModal.placeholder': '例: 仕事、趣味、学習',
    'savedTabs.categoryModal.selectLabel': '親カテゴリ選択',
    'savedTabs.categoryModal.selectPlaceholder':
      '作成済みのカテゴリを選択してドメインを管理',
    'savedTabs.categoryModal.title': '親カテゴリ管理',
    'savedTabs.categoryModal.toggleError': 'カテゴリの設定に失敗しました',
    'savedTabs.categoryModal.uncategorized': '未分類',
    'savedTabs.categoryModal.uncategorizedAria': '未分類のドメイン',
    'savedTabs.categoryModal.uncategorizedDirectEditError':
      '未分類カテゴリでは直接操作できません。カテゴリを選択してください。',
    'savedTabs.categoryModal.validation.empty':
      '新規親カテゴリ名を入力してください',
    'savedTabs.categoryModal.validation.maxLength':
      '新規親カテゴリ名は25文字以下にしてください',
    'savedTabs.customProjects.emptyDescription':
      '表示可能なプロジェクトがありません',
    'savedTabs.customProjects.emptyHint':
      '親カテゴリを作成するとプロジェクトとして表示されます',
    'savedTabs.customProjects.emptyTitle': 'プロジェクトがありません',
    'savedTabs.customProjects.createAction': '作成',
    'savedTabs.customProjects.createDialogTitle': '新規プロジェクト作成',
    'savedTabs.customProjects.createPlaceholder':
      '例: ウェブサイトリニューアル、ライブラリ調査',
    'savedTabs.customProjects.nameLabel': 'プロジェクト名 *',
    'savedTabs.category.deleteAllItemName': 'このカテゴリのドメイン',
    'savedTabs.category.deleteAllWarning':
      'カテゴリ内のすべてのドメインを削除します。この操作は元に戻せません。',
    'savedTabs.categoryManagement.addDomainLabel': '新しいドメインを追加',
    'savedTabs.categoryManagement.addDomainPlaceholder':
      'カテゴリに追加するドメインを選択',
    'savedTabs.categoryManagement.addDomainTooltip':
      '選択したドメインを親カテゴリに追加',
    'savedTabs.categoryManagement.deleteAction': '親カテゴリを削除',
    'savedTabs.categoryManagement.deleteConfirmDescription':
      '親カテゴリ「{{name}}」を削除しますか？この操作は取り消せません。',
    'savedTabs.categoryManagement.deleteConfirmDomains':
      'このカテゴリには {{count}} 件のドメインが関連付けられています。削除すると、ドメインと親カテゴリの関連付けも削除されます。',
    'savedTabs.categoryManagement.nameLabel': '親カテゴリ名',
    'savedTabs.categoryManagement.noAvailableDomains':
      '追加できるドメインがありません。',
    'savedTabs.categoryManagement.registeredDomainsEmpty':
      '登録されているドメインがありません',
    'savedTabs.categoryManagement.registeredDomainsLabel': '登録済みドメイン',
    'savedTabs.categoryManagement.renameError':
      '親カテゴリ名の更新に失敗しました',
    'savedTabs.categoryManagement.removeDomainAria': 'ドメインを削除',
    'savedTabs.categoryManagement.renameAction': '親カテゴリ名を変更',
    'savedTabs.categoryManagement.renamePlaceholder':
      '例: ビジネスツール、技術情報',
    'savedTabs.categoryManagement.renamePrompt':
      '「{{name}}」の新しい親カテゴリ名を入力してください',
    'savedTabs.categoryManagement.renamed':
      'カテゴリ名を「{{before}}」から「{{after}}」に変更しました',
    'savedTabs.categoryManagement.reorderCanceled':
      '親カテゴリの並び替えをキャンセルしました',
    'savedTabs.categoryManagement.reorderUpdated':
      '親カテゴリの順序を変更しました',
    'savedTabs.categoryManagement.reorderUpdateError':
      '親カテゴリ順序の更新に失敗しました',
    'savedTabs.categoryManagement.title': '「{{name}}」の親カテゴリ管理',
    'savedTabs.collapse': '折りたたむ',
    'savedTabs.domainOrder.updated': 'ドメインの順序を変更しました',
    'savedTabs.domainOrder.updateError': 'ドメイン順序の更新に失敗しました',
    'savedTabs.domainOrder.canceled': '並び替えをキャンセルしました',
    'savedTabs.domain.deleteAllWarning':
      'このドメインのすべてのタブを削除します。この操作は元に戻せません。',
    'savedTabs.deleteAll': 'すべて削除',
    'savedTabs.deleteAllDefaultWarning':
      'すべての項目を削除します。この操作は元に戻せません。',
    'savedTabs.deleteAllTitle': '{{itemName}}をすべて削除しますか？',
    'savedTabs.domain.emptyManageCategoriesHint':
      'カテゴリを追加するにはカテゴリ管理から行ってください',
    'savedTabs.domain.emptyNoTabs': 'このドメインにはタブがありません',
    'savedTabs.emptyDescription':
      'タブを右クリックして保存するか、拡張機能のアイコンをクリックしてください',
    'savedTabs.emptyTitle': '保存されたタブはありません',
    'savedTabs.expand': '展開',
    'savedTabs.deleteAllConfirmDescription':
      '「{{categoryName}}」のタブをすべて削除します。この操作は元に戻せません。',
    'savedTabs.deleteAllConfirmTitle': 'タブをすべて削除しますか？',
    'savedTabs.deleteAllTabs': 'すべてのタブを削除',
    'savedTabs.deletingAll': '削除中...',
    'savedTabs.domainsCount': 'ドメイン:{{count}}',
    'savedTabs.keywords.activeCategoryLabel':
      '「{{name}}」子カテゴリのキーワード',
    'savedTabs.keywords.addAria': 'キーワードを追加',
    'savedTabs.keywords.autoAssignHint':
      'タイトルにキーワードが含まれていると自動的にこの子カテゴリに分類されます',
    'savedTabs.keywords.duplicate': 'このキーワードは既に追加されています',
    'savedTabs.keywords.deleteAria': 'キーワードを削除',
    'savedTabs.keywords.deleteAriaWithName': 'キーワード {{name}} を削除',
    'savedTabs.keywords.empty': 'キーワードがありません',
    'savedTabs.keywords.placeholder': '例: 技術、新機能、チュートリアル',
    'savedTabs.keywordModal.title': '「{{domain}}」の子カテゴリ管理',
    'savedTabs.manageParentCategories': '親カテゴリ管理',
    'savedTabs.manageSubcategories': '子カテゴリ管理',
    'savedTabs.newProjectPlaceholder': '例: 仕事、調査、後で読む',
    'savedTabs.newProjectTitle': '新しいプロジェクトを追加',
    'savedTabs.openAll': 'すべて開く',
    'savedTabs.openAllConfirmDescription':
      '{{count}}個以上のタブを開こうとしています。続行しますか？',
    'savedTabs.openAllConfirmTitle': 'タブをすべて開きますか？',
    'savedTabs.openAllTabs': 'すべてのタブを開く',
    'savedTabs.projectAdded': 'プロジェクト「{{name}}」を追加しました',
    'savedTabs.projectCard.dropToUncategorized':
      'タブをここにドロップして未分類に移動',
    'savedTabs.projectCard.uncategorizedArea': '未分類タブエリア',
    'savedTabs.projectCard.uncategorizedTitle': '未分類のタブ',
    'savedTabs.project.deleteAllItemName': 'このプロジェクトのタブ',
    'savedTabs.project.deleteAllWarning':
      'このプロジェクト内のすべてのタブを削除します。この操作は元に戻せません。',
    'savedTabs.projectManagement.autoAssignDescription':
      '新規保存されたタブが対象です。',
    'savedTabs.projectManagement.autoAssignLabel': '自動振り分けキーワード',
    'savedTabs.projectManagement.deleteAction': 'プロジェクトを削除',
    'savedTabs.projectManagement.deleteConfirmDescription':
      'プロジェクト「{{name}}」を削除しますか？この操作は取り消せません。',
    'savedTabs.projectManagement.deleteConfirmHint':
      'このプロジェクトに含まれるすべてのタブとの紐付けも解除されます。',
    'savedTabs.projectManagement.keywordDomainDescription':
      'ドメインにキーワードが含まれていると、このプロジェクトに振り分けます',
    'savedTabs.projectManagement.keywordDomainLabel': 'ドメインキーワード',
    'savedTabs.projectManagement.keywordDomainPlaceholder': '例: github.com',
    'savedTabs.projectManagement.keywordTitleDescription':
      'タイトルにキーワードが含まれていると、このプロジェクトに振り分けます',
    'savedTabs.projectManagement.keywordTitleLabel': 'タイトルキーワード',
    'savedTabs.projectManagement.keywordTitlePlaceholder': '例: release',
    'savedTabs.projectManagement.keywordUrlDescription':
      'URL にキーワードが含まれていると、このプロジェクトに振り分けます',
    'savedTabs.projectManagement.keywordUrlLabel': 'URLキーワード',
    'savedTabs.projectManagement.keywordUrlPlaceholder': '例: docs',
    'savedTabs.projectManagement.nameLabel': 'プロジェクト名',
    'savedTabs.projectManagement.renameError':
      'プロジェクト名の変更に失敗しました',
    'savedTabs.projectManagement.renamed': 'プロジェクト名を変更しました',
    'savedTabs.projectManagement.renameAction': '名前を変更',
    'savedTabs.projectManagement.renamePlaceholder':
      '例: ウェブサイトリニューアル',
    'savedTabs.projectManagement.renamePrompt':
      '新しいプロジェクト名を入力してください',
    'savedTabs.projectManagement.title': '「{{name}}」の設定',
    'savedTabs.project.emptyDescription':
      '拡張機能アイコンからタブを保存するか、右クリックメニューから追加できます。',
    'savedTabs.project.emptyDragHint':
      '他のプロジェクトからタブをドラッグ&ドロップして追加することもできます。',
    'savedTabs.project.emptyTitle': 'このプロジェクトにはタブがありません。',
    'savedTabs.project.loadingTabs': 'タブを読み込み中...',
    'savedTabs.projectCategory.deleteAllWarning':
      '「{{categoryName}}」のタブをすべて削除します。この操作は元に戻せません。',
    'savedTabs.projectCategory.deleteAction': 'カテゴリを削除',
    'savedTabs.projectCategory.deleteWarning':
      'カテゴリを削除すると、このカテゴリに属するすべてのタブは未分類になります。',
    'savedTabs.projectCategory.added': 'カテゴリ「{{name}}」を追加しました',
    'savedTabs.projectCategory.deleted': 'カテゴリ「{{name}}」を削除しました',
    'savedTabs.projectCategory.manage': 'カテゴリ管理',
    'savedTabs.projectCategory.orderUpdated': 'カテゴリの順序を変更しました',
    'savedTabs.projectCategory.orderUpdateError':
      'カテゴリの順序更新に失敗しました',
    'savedTabs.projectCategory.renameDescription':
      'カテゴリ「{{name}}」を編集できます',
    'savedTabs.projectCategory.renameLabel': 'カテゴリ名',
    'savedTabs.projectCategory.renamePlaceholder': '例: 開発資料、参考サイト',
    'savedTabs.projectCategory.required': 'カテゴリ名を入力してください',
    'savedTabs.categoryCardAria': 'カテゴリ: {{name}}',
    'savedTabs.categoryGroupAria': '{{name}} カテゴリグループ',
    'savedTabs.projectCategory.renamed': 'カテゴリ名を変更しました',
    'savedTabs.projectCategory.title': 'カテゴリ管理',
    'savedTabs.projects.createError': 'プロジェクトの作成に失敗しました',
    'savedTabs.projects.deleted': 'プロジェクト「{{name}}」を削除しました',
    'savedTabs.projects.deleteError': 'プロジェクトの削除に失敗しました',
    'savedTabs.projects.duplicateName':
      'プロジェクト名「{{name}}」は既に使用されています',
    'savedTabs.projects.keywordsUpdated': 'キーワード設定を更新しました',
    'savedTabs.projects.keywordsUpdateError':
      'キーワード設定の更新に失敗しました',
    'savedTabs.projects.orderUpdated': 'プロジェクトの順序を変更しました',
    'savedTabs.projects.orderUpdateError':
      'プロジェクト順序の更新に失敗しました',
    'savedTabs.projectNameDuplicate': '同じプロジェクト名は追加できません',
    'savedTabs.projectNameMaxLength':
      'プロジェクト名は50文字以下にしてください',
    'savedTabs.projectNameRequired': 'プロジェクト名を入力してください',
    'savedTabs.projectsCount': 'プロジェクト:{{count}}',
    'savedTabs.reorder.disabled': '並び替えモード中',
    'savedTabs.reorder.cancel': 'キャンセル',
    'savedTabs.reorder.cancelAria': '親カテゴリの並び替えをキャンセル',
    'savedTabs.reorder.confirm': '確定',
    'savedTabs.reorder.confirmAria': '親カテゴリの並び替えを確定',
    'savedTabs.searchPlaceholder': '検索',
    'savedTabs.sort.asc': '保存日時の昇順',
    'savedTabs.sort.default': 'デフォルト',
    'savedTabs.sort.desc': '保存日時の降順',
    'savedTabs.sortableCategory.bulkDeleteTitle': 'タブを削除',
    'savedTabs.sortableCategory.bulkDeleteDescription':
      '「{{name}}」のタブをすべて削除しますか？',
    'savedTabs.sortableCategory.bulkOpenTitle': '複数タブを開く',
    'savedTabs.sortableCategory.tabCountLabel': 'タブ数',
    'savedTabs.subCategory.deleteSelected': '選択中の子カテゴリを削除',
    'savedTabs.subCategory.addPlaceholder': '例: ニュース、ブログ、コラム',
    'savedTabs.subCategory.addTitle': '新しい子カテゴリを追加',
    'savedTabs.subCategory.created': '新しいカテゴリ「{{name}}」を追加しました',
    'savedTabs.subCategory.createError': 'カテゴリの追加に失敗しました',
    'savedTabs.subCategory.deleted': 'カテゴリ「{{name}}」を削除しました',
    'savedTabs.subCategory.deleteConfirmHint':
      'この子カテゴリに属するすべてのタブは未分類になります',
    'savedTabs.subCategory.deleteConfirmTitle':
      '「{{name}}」子カテゴリを削除しますか？',
    'savedTabs.subCategory.deleteError': 'カテゴリの削除に失敗しました',
    'savedTabs.subCategory.deleteAria': 'カテゴリ {{name}} を削除',
    'savedTabs.subCategory.duplicateName': 'このカテゴリ名は既に存在しています',
    'savedTabs.subCategory.empty': 'このドメインには子カテゴリがありません。',
    'savedTabs.subCategory.keywordManagerTitle': '子カテゴリキーワード管理',
    'savedTabs.subCategory.renameHint': 'Enter で確定、Escape でキャンセル',
    'savedTabs.subCategory.renamePrompt':
      '「{{name}}」の新しい名前を入力してください。入力後、フォーカスを外すかEnterキーで保存されます。キャンセルするにはEscを押してください',
    'savedTabs.subCategory.renamed':
      'カテゴリ名を「{{before}}」から「{{after}}」に変更しました',
    'savedTabs.subCategory.renameError': 'カテゴリ名の変更に失敗しました',
    'savedTabs.subCategory.rename': '子カテゴリ名を変更',
    'savedTabs.subCategory.reorderUpdated': '子カテゴリの順序を変更しました',
    'savedTabs.subCategory.reorderUpdateError':
      '子カテゴリ順序の更新に失敗しました',
    'savedTabs.subCategory.reorderCanceled':
      '子カテゴリの並び替えをキャンセルしました',
    'savedTabs.subCategory.selectLabel': '子カテゴリを選択',
    'savedTabs.subCategory.selectPlaceholder': '管理する子カテゴリを選択',
    'savedTabs.subCategory.titleKeywords': '「{{name}}」カテゴリのキーワード',
    'savedTabs.tab.added': 'タブを追加しました',
    'savedTabs.tab.addError': 'タブの追加に失敗しました',
    'savedTabs.tab.categoryClearedAlt':
      'タブのカテゴリを解除しました（Alt+クリック）',
    'savedTabs.tab.deleteError': 'タブの削除に失敗しました',
    'savedTabs.tab.deleted': 'タブを削除しました',
    'savedTabs.tab.moveError': 'タブの分類更新に失敗しました',
    'savedTabs.tab.movedBetweenProjects': 'タブを移動しました',
    'savedTabs.tab.moveBetweenProjectsError': 'タブの移動に失敗しました',
    'savedTabs.tab.movedToCategory': 'タブを「{{name}}」に移動しました',
    'savedTabs.tab.movedToUncategorized': 'タブを未分類に移動しました',
    'savedTabs.tab.orderUpdated': 'タブの順序を変更しました',
    'savedTabs.tab.orderUpdateError': 'タブの順序更新に失敗しました',
    'savedTabs.tabs.deletedCount': '{{count}}件のタブを削除しました',
    'savedTabs.tabCount': 'タブ:{{count}}',
    'savedTabs.uncategorized': '未分類',
    'savedTabs.uncategorizedDomainsTitle': '未分類のドメイン',
    'savedTabs.url.deleteAria': 'タブを削除',
    'savedTabs.url.deleteConfirmDescription':
      'このタブを削除します。この操作は元に戻せません。',
    'savedTabs.url.deleteConfirmTitle': 'タブを削除しますか？',
    'savedTabs.viewMode.changeError': '表示モードの切り替えに失敗しました',
    'savedTabs.viewMode.custom': 'カスタムモード',
    'savedTabs.viewMode.domain': 'ドメインモード',
    'savedTabs.viewMode.placeholder': '表示モード',
    'savedTabs.viewMode.selectPlaceholder':
      'ドメインまたはカスタムモードを選択',
    'savedTabs.viewMode.tooltip': '表示モード切り替え',
    'sidebar.analytics': '分析',
    'sidebar.chat': 'チャット',
    'sidebar.collapse': 'サイドバーを小さくする',
    'sidebar.open': 'サイドバーを開く',
    'sidebar.resize': 'サイドバーの幅を調整',
    'tool.status.approvalRequested': '承認待ち',
    'tool.status.approvalResponded': '応答済み',
    'tool.status.inputAvailable': '実行中',
    'tool.status.inputStreaming': '待機中',
    'tool.status.outputAvailable': '完了',
    'tool.status.outputDenied': '却下',
    'tool.status.outputError': 'エラー',
    'background.contextMenu.openSavedTabs': '保存したタブを開く',
    'background.contextMenu.saveCurrentTab': '現在のタブを保存',
    'background.contextMenu.saveAllTabs': 'ウィンドウのすべてのタブを保存',
    'background.contextMenu.saveSameDomainTabs':
      '現在開いているドメインのタブをすべて保存',
    'background.contextMenu.saveAllWindowsTabs':
      '他のウィンドウを含めすべてのタブを保存',
    'background.saveTabs.notificationTitle': 'タブ保存',
    'background.saveTabs.currentTabSaved': '現在のタブを保存しました',
    'background.saveTabs.sameDomainSaved':
      '{{domain}}の{{count}}個のタブを保存しました',
    'background.saveTabs.allWindowsSaved':
      'すべてのウィンドウから{{count}}個のタブを保存しました',
    'background.saveTabs.windowTabsSaved':
      '{{count}}個のタブが保存されました。タブを閉じます。',
    'sidebar.options': 'オプション',
    'sidebar.periodicExecution': '定期実行',
    'sidebar.tabList': 'タブ一覧',
  },
} as const satisfies Record<AppLanguage, Record<string, string>>

const getMessages = (language: AppLanguage) => messages[language]
type AppLanguage = 'ja' | 'en'
type LanguageSetting = 'system' | AppLanguage

interface ChangelogFeature {
  text: string
  highlight?: boolean
}

interface ChangelogItem {
  version: string
  date: string
  features: ChangelogFeature[]
}

const changelogItems: Record<AppLanguage, ChangelogItem[]> = {
  en: [
    {
      version: '2.0.0',
      date: '2026-03-14',
      features: [
        {
          text: 'Added a sidebar chat experience that lets you work with saved tabs without leaving the current screen. Use it to research and organize without switching contexts.',
        },
        {
          text: 'Preview: added analytics so you can review patterns in saved tabs with charts and summaries.',
        },
        {
          text: 'Made Custom Mode generally available. Project-specific organization and management are now safer and easier to use.',
        },
        {
          text: 'Various usability improvements and minor fixes.',
        },
      ],
    },
    {
      version: '1.2.0',
      date: '2026-02-27',
      features: [
        {
          text: 'Added the ability to remove an item from its original list when a drag-and-drop move succeeds.',
        },
        {
          text: 'Various improvements including performance gains and bug fixes.',
        },
      ],
    },
    {
      version: '1.1.0',
      date: '2025-04-29',
      features: [
        {
          text: 'Added a powerful search feature. Just type a keyword to quickly find saved tabs.',
        },
        {
          text: 'Refreshed the design to make the app easier to use and easier to scan.',
        },
        {
          text: 'Confirmation dialogs now appear when tabs or categories are deleted, helping prevent mistakes.',
        },
        {
          text: 'Domains and categories can now be temporarily collapsed, so you can focus on the information you need.',
        },
        {
          text: 'Sorting by registration date now supports ascending and descending order, making it easy to review newer or older saved tabs.',
        },
        {
          text: 'Added a background-tab open option so you can open saved tabs without interrupting your current work.',
        },
        {
          text: 'Preview: implemented Custom Mode for more flexible configuration.',
        },
        {
          text: "Preview: added color customization so you can change the app's appearance to match your preference.",
        },
        {
          text: 'Various improvements including performance gains and bug fixes.',
        },
      ],
    },
    {
      version: '1.0.0',
      date: '2025-03-21',
      features: [
        {
          text: 'Initial release. Categories, quick access, and efficient organization for tabs and bookmarks.',
        },
      ],
    },
  ],
  ja: [
    {
      version: '2.0.0',
      date: '2026-03-14',
      features: [
        {
          text: '保存したタブを見ながらそのまま使える、サイドバーのチャット機能を追加しました。調べものや整理を、画面を切り替えずに進められます。',
        },
        {
          text: 'プレビュー版：分析機能を追加しました。保存したタブの傾向を、グラフや要約で確認できます。',
        },
        {
          text: 'カスタムモードを正式リリースしました。プロジェクトごとの整理や管理を、これまで以上に安心して使えるようになりました。',
        },
        {
          text: 'その他、使いやすさの向上や細かな改善を行いました。',
        },
      ],
    },
    {
      version: '1.2.0',
      date: '2026-02-27',
      features: [
        {
          text: 'ドラッグ&ドロップで移動が成功した際、元のリストから削除できる機能を追加しました。',
        },
        {
          text: 'その他、パフォーマンスの向上やバグ修正など、様々な改善を行いました。',
        },
      ],
    },
    {
      version: '1.1.0',
      date: '2025-04-29',
      features: [
        {
          text: '便利な検索機能を追加しました。キーワードを入力するだけで、保存したタブをすばやく見つけることができます。',
        },
        { text: 'より使いやすく、見やすくなるようデザインを改善しました。' },
        {
          text: 'タブやカテゴリの削除時に確認ダイアログが表示されるようになり、誤操作を防止できます。',
        },
        {
          text: 'ドメインやカテゴリを一時的に閉じることができるようになり、必要な情報だけを表示できます。',
        },
        {
          text: '登録日時によって昇順・降順に並び替えができるようになり、新しく保存したタブや古く保存したタブを簡単に確認できます。',
        },
        {
          text: '保存したタブをバックグラウンドタブで開く機能を追加し、現在の作業を中断せずにタブを開けるようになりました。',
        },
        {
          text: 'プレビュー版：カスタムモードを実装し、より柔軟な設定が可能になりました。',
        },
        {
          text: 'プレビュー版：カラーカスタマイズ機能を追加し、お好みの色でアプリの外観を変更できます。',
        },
        {
          text: 'その他、パフォーマンスの向上やバグ修正など、様々な改善を行いました。',
        },
      ],
    },
    {
      version: '1.0.0',
      date: '2025-03-21',
      features: [
        {
          text: '初回リリース。タブやブックマークを効率的に管理できるツールとして、カテゴリ別の整理や簡単なアクセスが可能になりました。',
        },
      ],
    },
  ],
}

const getChangelogItems = (language: AppLanguage) => changelogItems[language]

export type { AppLanguage, ChangelogFeature, ChangelogItem, LanguageSetting }
export { getChangelogItems, getMessages }
