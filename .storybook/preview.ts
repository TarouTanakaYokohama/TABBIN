import '../assets/global.css'
import type { Preview } from '@storybook/react'
import {
  previewDecorators,
  previewGlobalTypes,
  previewParameters,
} from '../lib/storybook/preview'

export default {
  decorators: previewDecorators,
  globalTypes: previewGlobalTypes,
  parameters: previewParameters,
} satisfies Preview
