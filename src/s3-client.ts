import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { S3Config } from './types'
import { Readable } from 'stream'

/**
 * Wrapper around S3Client with convenience methods for artifact operations
 */
export class S3ClientWrapper {
  private client: S3Client
  private bucket: string
  private prefix: string

  constructor(config: S3Config) {
    this.bucket = config.bucket
    this.prefix = config.prefix?.replace(/\/+$/, '') ?? ''

    // Only include credentials in config if explicitly provided
    // Otherwise, let the SDK use its default credential provider chain
    // (environment variables, shared credentials file, etc.)
    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region: config.region ?? 'us-east-1',
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle ?? !!config.endpoint,
    }

    if (config.credentials) {
      clientConfig.credentials = config.credentials
    }

    this.client = new S3Client(clientConfig)
  }

  /**
   * Build the full S3 key for a given path
   */
  buildKey(...parts: string[]): string {
    const allParts = this.prefix ? [this.prefix, ...parts] : parts
    return allParts.filter(Boolean).join('/')
  }

  /**
   * Upload a file to S3
   */
  async uploadFile(
    key: string,
    body: Buffer | Readable,
    options?: {
      contentType?: string
      metadata?: Record<string, string>
    }
  ): Promise<{ etag: string }> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
      },
      queueSize: 4,
      partSize: 1024 * 1024 * 5, // 5MB parts
      leavePartsOnError: false,
    })

    const result = await upload.done()
    return { etag: result.ETag ?? '' }
  }

  /**
   * Upload a small object (< 5MB) directly
   */
  async putObject(
    key: string,
    body: Buffer | string,
    options?: {
      contentType?: string
      metadata?: Record<string, string>
    }
  ): Promise<{ etag: string }> {
    const result = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
      })
    )
    return { etag: result.ETag ?? '' }
  }

  /**
   * Download a file from S3
   */
  async downloadFile(key: string): Promise<{
    body: Readable
    contentLength: number
    metadata?: Record<string, string>
  }> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    )

    if (!result.Body) {
      throw new Error(`No body returned for key: ${key}`)
    }

    return {
      body: result.Body as Readable,
      contentLength: result.ContentLength ?? 0,
      metadata: result.Metadata,
    }
  }

  /**
   * Get object metadata without downloading
   */
  async headObject(key: string): Promise<{
    contentLength: number
    metadata?: Record<string, string>
    lastModified?: Date
  } | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      )
      return {
        contentLength: result.ContentLength ?? 0,
        metadata: result.Metadata,
        lastModified: result.LastModified,
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NotFound') {
        return null
      }
      throw error
    }
  }

  /**
   * List objects with a given prefix
   */
  async listObjects(prefix: string): Promise<
    Array<{
      key: string
      size: number
      lastModified?: Date
    }>
  > {
    const objects: Array<{
      key: string
      size: number
      lastModified?: Date
    }> = []

    let continuationToken: string | undefined

    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      )

      for (const obj of result.Contents ?? []) {
        if (obj.Key) {
          objects.push({
            key: obj.Key,
            size: obj.Size ?? 0,
            lastModified: obj.LastModified,
          })
        }
      }

      continuationToken = result.NextContinuationToken
    } while (continuationToken)

    return objects
  }

  /**
   * List "directories" (common prefixes) under a prefix
   */
  async listPrefixes(prefix: string): Promise<string[]> {
    const prefixes: string[] = []
    let continuationToken: string | undefined

    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          Delimiter: '/',
          ContinuationToken: continuationToken,
        })
      )

      for (const commonPrefix of result.CommonPrefixes ?? []) {
        if (commonPrefix.Prefix) {
          prefixes.push(commonPrefix.Prefix)
        }
      }

      continuationToken = result.NextContinuationToken
    } while (continuationToken)

    return prefixes
  }

  /**
   * Delete multiple objects
   */
  async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return

    // S3 DeleteObjects supports max 1000 keys per request
    const batches: string[][] = []
    for (let i = 0; i < keys.length; i += 1000) {
      batches.push(keys.slice(i, i + 1000))
    }

    for (const batch of batches) {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: batch.map((key) => ({ Key: key })),
            Quiet: true,
          },
        })
      )
    }
  }

  /**
   * Check if an object exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.headObject(key)
    return result !== null
  }

  /**
   * Get the S3 URL for a key
   */
  getUrl(key: string): string {
    return `s3://${this.bucket}/${key}`
  }

  /**
   * Get the bucket name
   */
  getBucket(): string {
    return this.bucket
  }

  /**
   * Get the prefix
   */
  getPrefix(): string {
    return this.prefix
  }
}
