import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import * as core from '@actions/core'
import { minimatch } from 'minimatch'
import { S3ClientWrapper } from './s3-client'
import {
  S3Config,
  GitHubContext,
  DownloadArtifactOptions,
  DownloadArtifactResult,
  ArtifactMetadata,
  ArtifactInfo,
} from './types'

const METADATA_FILE = '_artifact_metadata.json'

/**
 * Download artifacts from S3
 */
export class ArtifactDownloader {
  private s3: S3ClientWrapper
  private context: GitHubContext

  constructor(s3Config: S3Config, context: GitHubContext) {
    this.s3 = new S3ClientWrapper(s3Config)
    this.context = context
  }

  /**
   * Download artifacts
   */
  async download(options: DownloadArtifactOptions): Promise<DownloadArtifactResult> {
    const {
      name,
      pattern,
      path: destPath,
      mergeMultiple = false,
      repository = this.context.repository,
      runId = this.context.runId,
    } = options

    core.info(`Downloading artifacts...`)

    // List available artifacts
    const artifacts = await this.listArtifacts(repository, runId)

    if (artifacts.length === 0) {
      throw new Error(`No artifacts found for ${repository} run ${runId}`)
    }

    // Filter artifacts by name or pattern
    let matchedArtifacts: ArtifactInfo[]

    if (name) {
      matchedArtifacts = artifacts.filter((a) => a.name === name)
      if (matchedArtifacts.length === 0) {
        throw new Error(`Artifact '${name}' not found`)
      }
    } else if (pattern) {
      matchedArtifacts = artifacts.filter((a) => minimatch(a.name, pattern))
      if (matchedArtifacts.length === 0) {
        throw new Error(`No artifacts matching pattern '${pattern}'`)
      }
    } else {
      // Download all artifacts
      matchedArtifacts = artifacts
    }

    core.info(`Found ${matchedArtifacts.length} artifact(s) to download`)

    // Download each artifact
    let totalFilesDownloaded = 0
    const downloadedArtifactNames: string[] = []

    for (const artifact of matchedArtifacts) {
      core.info(`Downloading artifact '${artifact.name}'...`)

      // Determine destination directory
      const artifactDestPath = mergeMultiple
        ? destPath
        : path.join(destPath, artifact.name)

      const filesDownloaded = await this.downloadArtifact(artifact, artifactDestPath)
      totalFilesDownloaded += filesDownloaded
      downloadedArtifactNames.push(artifact.name)

      core.info(`  Downloaded ${filesDownloaded} file(s)`)
    }

    core.info(`Successfully downloaded ${totalFilesDownloaded} file(s) total`)

    return {
      downloadPath: destPath,
      artifactNames: downloadedArtifactNames,
      filesDownloaded: totalFilesDownloaded,
    }
  }

  /**
   * List all artifacts for a given repository and run
   */
  async listArtifacts(
    repository: string = this.context.repository,
    runId: number = this.context.runId
  ): Promise<ArtifactInfo[]> {
    const artifacts: ArtifactInfo[] = []

    // Look for all run attempts
    const repoPrefix = this.s3.buildKey(
      repository.replace('/', '_'),
      runId.toString()
    )

    const attemptPrefixes = await this.s3.listPrefixes(`${repoPrefix}/`)

    for (const attemptPrefix of attemptPrefixes) {
      const artifactPrefixes = await this.s3.listPrefixes(attemptPrefix)

      for (const artifactPrefix of artifactPrefixes) {
        const metadataKey = `${artifactPrefix}${METADATA_FILE}`

        try {
          const { body } = await this.s3.downloadFile(metadataKey)
          const content = await this.streamToString(body)
          const metadata: ArtifactMetadata = JSON.parse(content)

          artifacts.push({
            name: metadata.name,
            key: artifactPrefix.replace(/\/$/, ''),
            metadata,
          })
        } catch (error) {
          core.debug(`Failed to read metadata from ${metadataKey}: ${error}`)
        }
      }
    }

    // Sort by creation time (newest first)
    artifacts.sort((a, b) => {
      const timeA = new Date(a.metadata.createdAt).getTime()
      const timeB = new Date(b.metadata.createdAt).getTime()
      return timeB - timeA
    })

    // Deduplicate by name (keep newest)
    const seen = new Set<string>()
    return artifacts.filter((a) => {
      if (seen.has(a.name)) return false
      seen.add(a.name)
      return true
    })
  }

  /**
   * Download a single artifact
   */
  private async downloadArtifact(
    artifact: ArtifactInfo,
    destPath: string
  ): Promise<number> {
    // Ensure destination directory exists
    await fs.promises.mkdir(destPath, { recursive: true })

    const filesPrefix = `${artifact.key}/files/`
    const files = await this.s3.listObjects(filesPrefix)

    let filesDownloaded = 0

    for (const file of files) {
      // Get relative path from the files prefix
      const relativePath = file.key.slice(filesPrefix.length)
      const destFilePath = path.join(destPath, relativePath)

      // Ensure parent directory exists
      await fs.promises.mkdir(path.dirname(destFilePath), { recursive: true })

      core.debug(`Downloading: ${relativePath}`)

      // Download the file
      const { body, metadata } = await this.s3.downloadFile(file.key)

      // Check if file is compressed
      const isCompressed = metadata?.['compressed'] === 'true'

      if (isCompressed) {
        // Decompress and write
        const gunzip = zlib.createGunzip()
        const writeStream = fs.createWriteStream(destFilePath)
        await pipeline(body, gunzip, writeStream)
      } else {
        // Write directly
        const writeStream = fs.createWriteStream(destFilePath)
        await pipeline(body, writeStream)
      }

      filesDownloaded++
    }

    return filesDownloaded
  }

  /**
   * Convert a readable stream to a string
   */
  private async streamToString(stream: Readable): Promise<string> {
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks).toString('utf-8')
  }
}
