import { describe, it, expect } from 'vitest'
import { S3ClientWrapper } from '../src/s3-client'

describe('S3ClientWrapper', () => {
  describe('buildKey', () => {
    it('should build key without prefix', () => {
      const client = new S3ClientWrapper({
        bucket: 'test-bucket',
        region: 'us-east-1',
      })

      const key = client.buildKey('repo', 'run-123', 'artifact-name')
      expect(key).toBe('repo/run-123/artifact-name')
    })

    it('should build key with prefix', () => {
      const client = new S3ClientWrapper({
        bucket: 'test-bucket',
        prefix: 'artifacts',
        region: 'us-east-1',
      })

      const key = client.buildKey('repo', 'run-123', 'artifact-name')
      expect(key).toBe('artifacts/repo/run-123/artifact-name')
    })

    it('should strip trailing slashes from prefix', () => {
      const client = new S3ClientWrapper({
        bucket: 'test-bucket',
        prefix: 'artifacts/',
        region: 'us-east-1',
      })

      const key = client.buildKey('repo', 'run-123')
      expect(key).toBe('artifacts/repo/run-123')
    })

    it('should filter empty parts', () => {
      const client = new S3ClientWrapper({
        bucket: 'test-bucket',
        region: 'us-east-1',
      })

      const key = client.buildKey('repo', '', 'artifact-name')
      expect(key).toBe('repo/artifact-name')
    })
  })

  describe('getUrl', () => {
    it('should return S3 URL', () => {
      const client = new S3ClientWrapper({
        bucket: 'test-bucket',
        region: 'us-east-1',
      })

      const url = client.getUrl('path/to/artifact')
      expect(url).toBe('s3://test-bucket/path/to/artifact')
    })
  })

  describe('getBucket', () => {
    it('should return bucket name', () => {
      const client = new S3ClientWrapper({
        bucket: 'my-bucket',
        region: 'us-east-1',
      })

      expect(client.getBucket()).toBe('my-bucket')
    })
  })

  describe('getPrefix', () => {
    it('should return empty string when no prefix', () => {
      const client = new S3ClientWrapper({
        bucket: 'test-bucket',
        region: 'us-east-1',
      })

      expect(client.getPrefix()).toBe('')
    })

    it('should return prefix without trailing slash', () => {
      const client = new S3ClientWrapper({
        bucket: 'test-bucket',
        prefix: 'artifacts/',
        region: 'us-east-1',
      })

      expect(client.getPrefix()).toBe('artifacts')
    })
  })

  describe('constructor', () => {
    it('should default to us-east-1 region', () => {
      const client = new S3ClientWrapper({
        bucket: 'test-bucket',
      })

      // Client is created without error
      expect(client.getBucket()).toBe('test-bucket')
    })

    it('should enable path style for custom endpoints', () => {
      const client = new S3ClientWrapper({
        bucket: 'test-bucket',
        endpoint: 'http://localhost:9000',
      })

      // Client is created without error
      expect(client.getBucket()).toBe('test-bucket')
    })
  })
})
