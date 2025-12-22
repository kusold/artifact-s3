/**
 * Configuration for S3-based artifact storage
 */
export interface S3Config {
  /**
   * S3 bucket name
   */
  bucket: string

  /**
   * Optional prefix for all artifacts (e.g., "artifacts/")
   */
  prefix?: string

  /**
   * S3-compatible endpoint URL (for MinIO, R2, etc.)
   * If not specified, uses AWS S3
   */
  endpoint?: string

  /**
   * AWS region
   */
  region?: string

  /**
   * Force path-style URLs (required for some S3-compatible stores)
   */
  forcePathStyle?: boolean

  /**
   * AWS credentials (optional - falls back to environment/instance credentials)
   */
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }
}

/**
 * Context from the GitHub Actions environment
 */
export interface GitHubContext {
  /**
   * Repository owner and name (e.g., "owner/repo")
   */
  repository: string

  /**
   * Workflow run ID
   */
  runId: number

  /**
   * Workflow run attempt number
   */
  runAttempt: number
}

/**
 * Options for uploading an artifact
 */
export interface UploadArtifactOptions {
  /**
   * Name of the artifact
   */
  name: string

  /**
   * Files to upload (can be file paths, directory paths, or glob patterns)
   */
  paths: string[]

  /**
   * Root directory for the artifact (files are stored relative to this)
   */
  rootDirectory: string

  /**
   * Retention period in days (stored as metadata, not enforced by this library)
   */
  retentionDays?: number

  /**
   * Compression level (0-9, where 0 is no compression)
   */
  compressionLevel?: number

  /**
   * Whether to overwrite existing artifacts with the same name
   */
  overwrite?: boolean

  /**
   * Whether to include hidden files
   */
  includeHiddenFiles?: boolean
}

/**
 * Result of uploading an artifact
 */
export interface UploadArtifactResult {
  /**
   * Unique identifier for the artifact (S3 path)
   */
  id: string

  /**
   * S3 URL for the artifact
   */
  url: string

  /**
   * SHA-256 digest of the artifact
   */
  digest: string

  /**
   * Number of files uploaded
   */
  filesUploaded: number

  /**
   * Total size in bytes
   */
  totalSize: number
}

/**
 * Options for downloading an artifact
 */
export interface DownloadArtifactOptions {
  /**
   * Name of the artifact to download (optional if pattern is specified)
   */
  name?: string

  /**
   * Glob pattern to match artifact names
   */
  pattern?: string

  /**
   * Destination path for downloaded files
   */
  path: string

  /**
   * Whether to merge multiple artifacts into the same directory
   */
  mergeMultiple?: boolean

  /**
   * Repository to download from (defaults to current)
   */
  repository?: string

  /**
   * Run ID to download from (defaults to current)
   */
  runId?: number
}

/**
 * Result of downloading an artifact
 */
export interface DownloadArtifactResult {
  /**
   * Path where the artifact was downloaded
   */
  downloadPath: string

  /**
   * Names of artifacts that were downloaded
   */
  artifactNames: string[]

  /**
   * Number of files downloaded
   */
  filesDownloaded: number
}

/**
 * Metadata stored with each artifact
 */
export interface ArtifactMetadata {
  /**
   * Artifact name
   */
  name: string

  /**
   * Repository where the artifact was created
   */
  repository: string

  /**
   * Workflow run ID
   */
  runId: number

  /**
   * Workflow run attempt
   */
  runAttempt: number

  /**
   * When the artifact was created
   */
  createdAt: string

  /**
   * Retention period in days
   */
  retentionDays?: number

  /**
   * SHA-256 digest of the artifact archive
   */
  digest: string

  /**
   * Total size in bytes
   */
  totalSize: number

  /**
   * Number of files in the artifact
   */
  fileCount: number

  /**
   * List of files in the artifact
   */
  files: string[]
}

/**
 * Information about a listed artifact
 */
export interface ArtifactInfo {
  /**
   * Artifact name
   */
  name: string

  /**
   * S3 key prefix for the artifact
   */
  key: string

  /**
   * Artifact metadata
   */
  metadata: ArtifactMetadata
}

/**
 * Behavior when no files are found
 */
export type NoFilesFoundBehavior = 'warn' | 'error' | 'ignore'
