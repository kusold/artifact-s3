# artifact-s3

Core library for S3-based artifact storage in GitHub Actions. This library powers [action-upload-artifact-s3](https://github.com/kusold/action-upload-artifact-s3) and [action-download-artifact-s3](https://github.com/kusold/action-download-artifact-s3).

## Installation

```bash
npm install @kusold/artifact-s3
```

## Usage

### Upload an Artifact

```typescript
import { uploadArtifact, S3Config, GitHubContext } from '@kusold/artifact-s3'

const s3Config: S3Config = {
  bucket: 'my-artifacts-bucket',
  region: 'us-east-1',
  // For S3-compatible stores (Garage, MinIO, R2, etc.)
  // endpoint: 'https://s3.example.com',
  // forcePathStyle: true,
}

const context: GitHubContext = {
  repository: 'owner/repo',
  runId: 12345,
  runAttempt: 1,
}

const result = await uploadArtifact(s3Config, context, {
  name: 'my-artifact',
  paths: ['dist/**/*', 'build/output.zip'],
  rootDirectory: process.cwd(),
  compressionLevel: 6,
  overwrite: false,
})

console.log(`Uploaded ${result.filesUploaded} files`)
console.log(`Artifact ID: ${result.id}`)
console.log(`Digest: ${result.digest}`)
```

### Download an Artifact

```typescript
import { downloadArtifact, S3Config, GitHubContext } from '@kusold/artifact-s3'

const result = await downloadArtifact(s3Config, context, {
  name: 'my-artifact',
  path: './downloaded-artifacts',
})

console.log(`Downloaded ${result.filesDownloaded} files to ${result.downloadPath}`)
```

### List Artifacts

```typescript
import { listArtifacts, S3Config, GitHubContext } from '@kusold/artifact-s3'

const artifacts = await listArtifacts(s3Config, context)

for (const artifact of artifacts) {
  console.log(`${artifact.name}: ${artifact.metadata.fileCount} files, ${artifact.metadata.totalSize} bytes`)
}
```

## API Reference

### S3Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `bucket` | string | Yes | S3 bucket name |
| `prefix` | string | No | Prefix path within the bucket |
| `endpoint` | string | No | S3-compatible endpoint URL |
| `region` | string | No | AWS region (default: `us-east-1`) |
| `forcePathStyle` | boolean | No | Use path-style URLs (required for some S3-compatible stores) |
| `credentials` | object | No | AWS credentials (falls back to environment/instance credentials) |

### GitHubContext

| Property | Type | Description |
|----------|------|-------------|
| `repository` | string | Repository in `owner/repo` format |
| `runId` | number | Workflow run ID |
| `runAttempt` | number | Workflow run attempt number |

### UploadArtifactOptions

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Artifact name |
| `paths` | string[] | Yes | Files to upload (glob patterns supported) |
| `rootDirectory` | string | Yes | Root directory for relative paths |
| `retentionDays` | number | No | Retention period in days (metadata only) |
| `compressionLevel` | number | No | Gzip compression level 0-9 (default: 6) |
| `overwrite` | boolean | No | Replace existing artifact (default: false) |
| `includeHiddenFiles` | boolean | No | Include hidden files (default: false) |

### DownloadArtifactOptions

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | No | Artifact name to download |
| `pattern` | string | No | Glob pattern for artifact names |
| `path` | string | Yes | Destination directory |
| `mergeMultiple` | boolean | No | Merge multiple artifacts into same directory |
| `repository` | string | No | Repository to download from |
| `runId` | number | No | Run ID to download from |

## S3 Path Structure

Artifacts are stored with the following structure:

```
s3://{bucket}/{prefix}/{owner}_{repo}/{run-id}/{attempt}/{artifact-name}/
├── _artifact_metadata.json
└── files/
    └── ... (artifact files, optionally gzip compressed)
```

## S3-Compatible Storage

This library works with any S3-compatible storage:

- **AWS S3**
- **[Garage](https://garagehq.deuxfleurs.fr)** - Lightweight, self-hosted
- **Cloudflare R2**
- **MinIO**
- **DigitalOcean Spaces**
- **Backblaze B2**

For non-AWS stores, set `endpoint` and typically `forcePathStyle: true`.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## License

MIT
