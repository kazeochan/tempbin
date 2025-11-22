import { describe, it, expect, beforeAll, vi } from 'vitest';
import { uploadFileToR2, deleteFileFromR2, getBucketCors, putBucketCors } from './r2Service';
import { persistence } from '../utils/persistence';
import { R2Config } from '../types';
// @ts-ignore
import XHR2 from 'xhr2';

// Polyfill XMLHttpRequest for Node.js environment
global.XMLHttpRequest = XHR2;

// Mock persistence to return our test config
vi.mock('../utils/persistence', () => ({
  persistence: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

describe('R2 Service Integration Tests', () => {
  const env = import.meta.env;
  
  const testConfig: R2Config = {
    accountId: env.VITE_R2_ACCOUNT_ID,
    accessKeyId: env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: env.VITE_R2_SECRET_ACCESS_KEY,
    bucketName: env.VITE_R2_BUCKET_NAME,
    publicUrl: env.VITE_R2_PUBLIC_URL,
  };

  const testConfigNoPublicUrl: R2Config = {
    ...testConfig,
    publicUrl: undefined,
  };

  beforeAll(() => {
    if (!testConfig.accountId || !testConfig.accessKeyId || !testConfig.secretAccessKey || !testConfig.bucketName) {
      console.warn('Skipping R2 tests because credentials are missing in environment variables.');
    }
  });

  it('should upload a file and return a public URL when configured', async () => {
    // Mock persistence to return config with public URL
    vi.mocked(persistence.getItem).mockResolvedValue(JSON.stringify(testConfig));

    const fileContent = 'Hello, World! This is a test file.';
    const file = new File([fileContent], 'test-file-public.txt', { type: 'text/plain' });

    const result = await uploadFileToR2(file, false); // false to disable hashing for easier debugging/cleanup

    expect(result).toBeDefined();
    expect(result.fileId).toBe('test-file-public.txt');
    expect(result.url).toContain(testConfig.publicUrl);
    expect(result.url).toContain('test-file-public.txt');

    // Cleanup
    await deleteFileFromR2(result.fileId);
  }, 30000); // Increase timeout to 30s

  it('should upload a file and return a presigned URL when public URL is NOT configured', async () => {
    // Mock persistence to return config WITHOUT public URL
    vi.mocked(persistence.getItem).mockResolvedValue(JSON.stringify(testConfigNoPublicUrl));

    const fileContent = 'Hello, World! This is a test file without public URL.';
    const file = new File([fileContent], 'test-file-private.txt', { type: 'text/plain' });

    const result = await uploadFileToR2(file, false);

    expect(result).toBeDefined();
    expect(result.fileId).toBe('test-file-private.txt');
    // The URL should be a presigned URL (contains signature)
    expect(result.url).toContain('X-Amz-Signature');
    expect(result.url).toContain('r2.cloudflarestorage.com');

    // Cleanup
    await deleteFileFromR2(result.fileId);
  }, 30000);

  it('should check and set CORS policy', async () => {
     // Mock persistence to return config
     vi.mocked(persistence.getItem).mockResolvedValue(JSON.stringify(testConfig));

     // Set CORS
     await putBucketCors(testConfig, ['*']);

     // Verify CORS is set
     const corsExists = await getBucketCors(testConfig);
     expect(corsExists).toBe(true);
  }, 30000);
});
