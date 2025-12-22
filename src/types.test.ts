import { describe, it, expect } from 'vitest'
import {
  S3Config,
  GitHubContext,
  UploadArtifactOptions,
  DownloadArtifactOptions,
  ArtifactMetadata,
  NoFilesFoundBehavior,
} from '../src/types'

describe('Types', () => {
  describe('S3Config', () => {
    it('should accept minimal config', () => {
      const config: S3Config = {
        bucket: 'my-bucket',
      }
      expect(config.bucket).toBe('my-bucket')
      expect(config.region).toBeUndefined()
    })

    it('should accept full config', () => {
      const config: S3Config = {
        bucket: 'my-bucket',
        prefix: 'artifacts',
        endpoint: 'http://localhost:9000',
        region: 'us-west-2',
        forcePathStyle: true,
        credentials: {
          accessKeyId: 'key',
          secretAccessKey: 'secret',
          sessionToken: 'token',
        },
      }
      expect(config.bucket).toBe('my-bucket')
      expect(config.credentials?.accessKeyId).toBe('key')
    })
  })

  describe('GitHubContext', () => {
    it('should have required fields', () => {
      const context: GitHubContext = {
        repository: 'owner/repo',
        runId: 12345,
        runAttempt: 1,
      }
      expect(context.repository).toBe('owner/repo')
      expect(context.runId).toBe(12345)
      expect(context.runAttempt).toBe(1)
    })
  })

  describe('UploadArtifactOptions', () => {
    it('should accept minimal options', () => {
      const options: UploadArtifactOptions = {
        name: 'my-artifact',
        paths: ['dist/'],
        rootDirectory: '/workspace',
      }
      expect(options.name).toBe('my-artifact')
      expect(options.compressionLevel).toBeUndefined()
    })

    it('should accept full options', () => {
      const options: UploadArtifactOptions = {
        name: 'my-artifact',
        paths: ['dist/', 'build/'],
        rootDirectory: '/workspace',
        retentionDays: 30,
        compressionLevel: 9,
        overwrite: true,
        includeHiddenFiles: true,
      }
      expect(options.compressionLevel).toBe(9)
      expect(options.overwrite).toBe(true)
    })
  })

  describe('DownloadArtifactOptions', () => {
    it('should accept minimal options', () => {
      const options: DownloadArtifactOptions = {
        path: '/download',
      }
      expect(options.path).toBe('/download')
      expect(options.name).toBeUndefined()
    })

    it('should accept full options', () => {
      const options: DownloadArtifactOptions = {
        name: 'my-artifact',
        pattern: 'build-*',
        path: '/download',
        mergeMultiple: true,
        repository: 'owner/repo',
        runId: 12345,
      }
      expect(options.mergeMultiple).toBe(true)
      expect(options.runId).toBe(12345)
    })
  })

  describe('ArtifactMetadata', () => {
    it('should have all required fields', () => {
      const metadata: ArtifactMetadata = {
        name: 'my-artifact',
        repository: 'owner/repo',
        runId: 12345,
        runAttempt: 1,
        createdAt: '2024-01-01T00:00:00Z',
        digest: 'sha256:abc123',
        totalSize: 1024,
        fileCount: 5,
        files: ['file1.txt', 'file2.txt'],
      }
      expect(metadata.name).toBe('my-artifact')
      expect(metadata.fileCount).toBe(5)
    })
  })

  describe('NoFilesFoundBehavior', () => {
    it('should accept valid values', () => {
      const warn: NoFilesFoundBehavior = 'warn'
      const error: NoFilesFoundBehavior = 'error'
      const ignore: NoFilesFoundBehavior = 'ignore'

      expect(warn).toBe('warn')
      expect(error).toBe('error')
      expect(ignore).toBe('ignore')
    })
  })
})
