// Types
export {
  S3Config,
  GitHubContext,
  UploadArtifactOptions,
  UploadArtifactResult,
  DownloadArtifactOptions,
  DownloadArtifactResult,
  ArtifactMetadata,
  ArtifactInfo,
  NoFilesFoundBehavior,
} from './types'

// Classes
export { S3ClientWrapper } from './s3-client'
export { ArtifactUploader } from './upload'
export { ArtifactDownloader } from './download'

// Convenience functions
import { S3ClientWrapper } from './s3-client'
import { ArtifactUploader } from './upload'
import { ArtifactDownloader } from './download'
import {
  S3Config,
  GitHubContext,
  UploadArtifactOptions,
  UploadArtifactResult,
  DownloadArtifactOptions,
  DownloadArtifactResult,
  ArtifactInfo,
} from './types'

/**
 * Create an artifact uploader
 */
export function createUploader(
  s3Config: S3Config,
  context: GitHubContext
): ArtifactUploader {
  return new ArtifactUploader(s3Config, context)
}

/**
 * Create an artifact downloader
 */
export function createDownloader(
  s3Config: S3Config,
  context: GitHubContext
): ArtifactDownloader {
  return new ArtifactDownloader(s3Config, context)
}

/**
 * Upload an artifact
 */
export async function uploadArtifact(
  s3Config: S3Config,
  context: GitHubContext,
  options: UploadArtifactOptions
): Promise<UploadArtifactResult> {
  const uploader = createUploader(s3Config, context)
  return uploader.upload(options)
}

/**
 * Download an artifact
 */
export async function downloadArtifact(
  s3Config: S3Config,
  context: GitHubContext,
  options: DownloadArtifactOptions
): Promise<DownloadArtifactResult> {
  const downloader = createDownloader(s3Config, context)
  return downloader.download(options)
}

/**
 * List artifacts
 */
export async function listArtifacts(
  s3Config: S3Config,
  context: GitHubContext,
  repository?: string,
  runId?: number
): Promise<ArtifactInfo[]> {
  const downloader = createDownloader(s3Config, context)
  return downloader.listArtifacts(repository, runId)
}
