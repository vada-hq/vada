import type { OfflineClient } from '../data-sources/offline-client'
import { readDevelopmentData } from './read-data'
import { readDevelopmentOptions } from './read-options'
import { submitDevelopmentMutation } from './submit'

export const offlineClient: OfflineClient = {
  read: readDevelopmentData,
  options: readDevelopmentOptions,
  submit: submitDevelopmentMutation,
}
