import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as zlib from 'zlib'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import * as glob from '@actions/glob'
import * as core from '@actions/core'
import { S3ClientWrapper } from './s3-client'
import {
  S3Config,
  GitHubContext,
  UploadArtifactOptions,
  UploadArtifactResult,
  ArtifactMetadata,
} from './types'

const METADATA_FILE = '_artifact_metadata.json'

/**
 * Upload artifacts to S3
 */
export class ArtifactUploader {
  private s3: S3ClientWrapper
  private context: GitHubContext

  constructor(s3Config: S3Config, context: GitHubContext) {
    this.s3 = new S3ClientWrapper(s3Config)
    this.context = context
  }

  /**
   * Upload an artifact
   */
  async upload(options: UploadArtifactOptions): Promise<UploadArtifactResult> {
    const {
      name,
      paths,
      rootDirectory,
      retentionDays,
      compressionLevel = 6,
      overwrite = false,
      includeHiddenFiles = false,
    } = options

    core.info(`Uploading artifact '${name}'...`)

    // Build the S3 key prefix for this artifact
    const artifactPrefix = this.buildArtifactPrefix(name)

    // Check if artifact already exists
    const metadataKey = `${artifactPrefix}/${METADATA_FILE}`
    const exists = await this.s3.exists(metadataKey)

    if (exists && !overwrite) {
      throw new Error(
        `Artifact '${name}' already exists. Use overwrite: true to replace it.`
      )
    }

    if (exists && overwrite) {
      core.info(`Deleting existing artifact '${name}'...`)
      await this.deleteArtifact(artifactPrefix)
    }

    // Resolve files from glob patterns
    const files = await this.resolveFiles(paths, rootDirectory, includeHiddenFiles)

    if (files.length === 0) {
      throw new Error('No files found to upload')
    }

    core.info(`Found ${files.length} file(s) to upload`)

    // Upload each file
    let totalSize = 0
    const uploadedFiles: string[] = []
    const hash = crypto.createHash('sha256')

    for (const file of files) {
      const relativePath = path.relative(rootDirectory, file.absolutePath)
      const s3Key = `${artifactPrefix}/files/${relativePath}`

      core.debug(`Uploading: ${relativePath}`)

      const fileContent = await fs.promises.readFile(file.absolutePath)
      hash.update(fileContent)

      let uploadContent: Buffer
      let contentType: string

      if (compressionLevel > 0) {
        uploadContent = await this.compress(fileContent, compressionLevel)
        contentType = 'application/gzip'
      } else {
        uploadContent = fileContent
        contentType = 'application/octet-stream'
      }

      await this.s3.uploadFile(s3Key, uploadContent, {
        contentType,
        metadata: {
          'original-size': fileContent.length.toString(),
          'compressed': compressionLevel > 0 ? 'true' : 'false',
        },
      })

      totalSize += fileContent.length
      uploadedFiles.push(relativePath)
    }

    const digest = hash.digest('hex')

    // Create and upload metadata
    const metadata: ArtifactMetadata = {
      name,
      repository: this.context.repository,
      runId: this.context.runId,
      runAttempt: this.context.runAttempt,
      createdAt: new Date().toISOString(),
      retentionDays,
      digest,
      totalSize,
      fileCount: uploadedFiles.length,
      files: uploadedFiles,
    }

    await this.s3.putObject(metadataKey, JSON.stringify(metadata, null, 2), {
      contentType: 'application/json',
    })

    const artifactUrl = this.s3.getUrl(artifactPrefix)

    core.info(`Successfully uploaded artifact '${name}'`)
    core.info(`  Files: ${uploadedFiles.length}`)
    core.info(`  Size: ${this.formatBytes(totalSize)}`)
    core.info(`  Digest: sha256:${digest}`)

    return {
      id: artifactPrefix,
      url: artifactUrl,
      digest: `sha256:${digest}`,
      filesUploaded: uploadedFiles.length,
      totalSize,
    }
  }

  /**
   * Build the S3 prefix for an artifact
   */
  private buildArtifactPrefix(name: string): string {
    return this.s3.buildKey(
      this.context.repository.replace('/', '_'),
      this.context.runId.toString(),
      this.context.runAttempt.toString(),
      name
    )
  }

  /**
   * Resolve glob patterns to file paths
   */
  private async resolveFiles(
    patterns: string[],
    rootDirectory: string,
    includeHiddenFiles: boolean
  ): Promise<Array<{ absolutePath: string }>> {
    const files: Array<{ absolutePath: string }> = []
    const seen = new Set<string>()

    for (const pattern of patterns) {
      // Make pattern absolute if it isn't already
      const absolutePattern = path.isAbsolute(pattern)
        ? pattern
        : path.join(rootDirectory, pattern)

      const globber = await glob.create(absolutePattern, {
        followSymbolicLinks: true,
        implicitDescendants: true,
        matchDirectories: false,
      })

      for await (const file of globber.globGenerator()) {
        // Skip hidden files if requested
        if (!includeHiddenFiles && this.isHidden(file, rootDirectory)) {
          continue
        }

        if (!seen.has(file)) {
          seen.add(file)
          files.push({ absolutePath: file })
        }
      }
    }

    return files
  }

  /**
   * Check if a file is hidden
   */
  private isHidden(filePath: string, rootDirectory: string): boolean {
    const relativePath = path.relative(rootDirectory, filePath)
    const parts = relativePath.split(path.sep)
    return parts.some((part) => part.startsWith('.'))
  }

  /**
   * Compress content using gzip
   */
  private async compress(content: Buffer, level: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gzip(content, { level }, (err, result) => {
        if (err) reject(err)
        else resolve(result)
      })
    })
  }

  /**
   * Delete an artifact by prefix
   */
  private async deleteArtifact(prefix: string): Promise<void> {
    const objects = await this.s3.listObjects(prefix)
    const keys = objects.map((obj) => obj.key)
    await this.s3.deleteObjects(keys)
  }

  /**
   * Format bytes as human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }
}
