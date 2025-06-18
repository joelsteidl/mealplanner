import { createClient } from 'next-sanity'
import { apiVersion, dataset, projectId, token } from '../env'

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false, // Disable CDN to prevent caching issues
  token, // Add token for write operations
  ignoreBrowserTokenWarning: true // Since we're using the token in both browser and server contexts
})
