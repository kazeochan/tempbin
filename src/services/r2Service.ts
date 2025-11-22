import { R2Config } from '../types';
import { persistence } from '../utils/persistence';

export const getR2Config = async (): Promise<R2Config | null> => {
  try {
    const config = await persistence.getItem('r2Config');
    return config ? JSON.parse(config) : null;
  } catch (error) {
    console.error('Error getting R2 config:', error);
    return null;
  }
};

export const calculateFileHash = async (file: File): Promise<string> => {
  // For large files (> 50MB), use a partial hash for performance
  if (file.size > 50 * 1024 * 1024) {
    return calculatePartialHash(file);
  }
  const buffer = await file.arrayBuffer();
  return sha256(buffer);
};

const calculatePartialHash = async (file: File): Promise<string> => {
  const chunkSize = 1024 * 1024; // 1MB
  const chunks: ArrayBuffer[] = [];
  
  // First 1MB
  chunks.push(await file.slice(0, chunkSize).arrayBuffer());
  
  // Middle 1MB
  const middle = Math.floor(file.size / 2);
  if (middle > chunkSize) {
    chunks.push(await file.slice(middle, middle + chunkSize).arrayBuffer());
  }
  
  // Last 1MB
  if (file.size > 2 * chunkSize) {
    chunks.push(await file.slice(Math.max(0, file.size - chunkSize)).arrayBuffer());
  }
  
  // Combine with size and name
  const encoder = new TextEncoder();
  const metadata = encoder.encode(`${file.name}-${file.size}`);
  
  // Hash all parts
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0) + metadata.length;
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  
  combined.set(metadata, offset);
  offset += metadata.length;
  
  for (const chunk of chunks) {
    combined.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }
  
  return sha256(combined);
};

export const saveR2Config = async (config: R2Config): Promise<void> => {
  try {
    await persistence.setItem('r2Config', JSON.stringify(config));
  } catch (error) {
    console.error('Error saving R2 config:', error);
    throw error;
  }
};

const sanitizeFileName = (fileName: string): string => {
  // Replace spaces with hyphens
  const noSpaces = fileName.replace(/\s+/g, '-');
  // Remove unsafe characters (keep unicode)
  // / \ : * ? " < > | and control characters
  const safeChars = noSpaces.replace(/[\/\\:*?"<>|\x00-\x1F\x7F]/g, '');
  // Remove consecutive dots or hyphens
  const result = safeChars.replace(/\.{2,}/g, '.').replace(/-{2,}/g, '-');
  // Trim dots and hyphens from start/end
  const trimmed = result.replace(/^[.-]+|[.-]+$/g, '');
  
  const finalName = trimmed || 'unnamed-file';
  
  // Encode to ensure URL friendliness (converts non-ASCII to %XX)
  return encodeURIComponent(finalName);
};

const generateFileId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const hashFileName = async (fileName: string): Promise<string> => {
  const extension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}${extension}`;
};

const createAwsSignature = async (
  method: string,
  path: string,
  headers: Record<string, string>,
  config: R2Config,
  payload: BufferSource | string = '',
  queryParams: Record<string, string> = {}
): Promise<string> => {
  const region = 'auto';
  const service = 's3';
  
  // Create canonical request
  const sortedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaders
    .map(key => `${key.toLowerCase()}:${headers[key].trim()}\n`)
    .join('');
  const signedHeaders = sortedHeaders.map(key => key.toLowerCase()).join(';');
  
  // Canonical query string
  const sortedKeys = Object.keys(queryParams).sort();
  const canonicalQueryString = sortedKeys
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&');

  const payloadHash = await sha256(payload);
  const canonicalRequest = `${method}\n${path}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  
  const date = headers['X-Amz-Date'];
  const dateStamp = date.substr(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${credentialScope}\n${canonicalRequestHash}`;
  
  // Calculate signature
  const signingKey = await getSignatureKey(config.secretAccessKey, dateStamp, region, service);
  const signature = await hmacSha256(signingKey, stringToSign);
  
  return `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
};

const sha256 = async (data: string | BufferSource): Promise<string> => {
  if (!crypto || !crypto.subtle) {
    throw new Error('crypto.subtle is not available. Please use HTTPS or localhost to enable secure cryptography APIs required for R2 uploads.');
  }
  const encoder = new TextEncoder();
  const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const hmacSha256 = async (key: ArrayBuffer, data: string): Promise<string> => {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const hmacSha256Buffer = async (key: ArrayBuffer, data: string): Promise<ArrayBuffer> => {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
};

const getSignatureKey = async (
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string
): Promise<ArrayBuffer> => {
  const encoder = new TextEncoder();
  const kDate = await hmacSha256Buffer(encoder.encode(`AWS4${key}`).buffer, dateStamp);
  const kRegion = await hmacSha256Buffer(kDate, regionName);
  const kService = await hmacSha256Buffer(kRegion, serviceName);
  const kSigning = await hmacSha256Buffer(kService, 'aws4_request');
  return kSigning;
};

const getAmzDate = (): string => {
  const now = new Date();
  return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
};

const generatePresignedUrl = async (
  fileName: string,
  config: R2Config,
  expiresIn: number = 600 // 10 minutes
): Promise<string> => {
  // If custom domain is configured, use it directly (no AWS signature needed)
  if (config.publicUrl) {
    return `${config.publicUrl.replace(/\/$/, '')}/${fileName}`;
  }
  
  // Otherwise, generate AWS pre-signed URL
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${config.bucketName}/${fileName}`;
  const region = 'auto';
  const service = 's3';
  
  const amzDate = getAmzDate();
  const dateStamp = amzDate.substr(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  
  // Build canonical query string for presigned URL
  const credential = encodeURIComponent(`${config.accessKeyId}/${credentialScope}`);
  const queryParams = [
    `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
    `X-Amz-Credential=${credential}`,
    `X-Amz-Date=${amzDate}`,
    `X-Amz-Expires=${expiresIn}`,
    `X-Amz-SignedHeaders=host`
  ].join('&');
  
  // Create canonical request (for pre-signed URLs, payload is always UNSIGNED-PAYLOAD)
  const canonicalHeaders = `host:${config.accountId}.r2.cloudflarestorage.com\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';
  
  const canonicalRequest = `GET\n${path}\n${queryParams}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  
  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;
  
  // Calculate signature
  const signingKey = await getSignatureKey(config.secretAccessKey, dateStamp, region, service);
  const signature = await hmacSha256(signingKey, stringToSign);
  
  return `${endpoint}${path}?${queryParams}&X-Amz-Signature=${signature}`;
};

export const uploadFileToR2 = async (
  file: File, 
  hashFilenames: boolean = true,
  onProgress?: (progress: number) => void,
  customName?: string
): Promise<{ fileId: string; url: string }> => {
  const config = await getR2Config();
  
  if (!config) {
    throw new Error('R2 configuration not found. Please configure your R2 settings.');
  }

  // Sanitize filename to be URL friendly
  const nameToUse = customName || file.name;
  const sanitizedName = sanitizeFileName(nameToUse);

  // Hash the filename to prevent guessing/enumeration while preserving extension, or use original name
  const fileName = hashFilenames ? await hashFileName(sanitizedName) : sanitizedName;

  if (file.size > MULTIPART_THRESHOLD) {
    // Multipart Upload
    const uploadId = await retry(() => initiateMultipartUpload(config, fileName, file.type || 'application/octet-stream'));
    const totalParts = Math.ceil(file.size / PART_SIZE);
    const partProgresses = new Array(totalParts).fill(0);
    
    // Create array of part indices
    const partIndices = Array.from({ length: totalParts }, (_, i) => i);

    try {
      const parts = await asyncPool(MAX_CONCURRENT_PARTS, partIndices, async (i) => {
        const start = i * PART_SIZE;
        const end = Math.min(start + PART_SIZE, file.size);
        const chunk = await file.slice(start, end).arrayBuffer();
        const partNumber = i + 1;

        const etag = await retry(() => uploadPart(config, fileName, uploadId, partNumber, chunk, (partProgress) => {
          partProgresses[i] = partProgress;
          if (onProgress) {
            // Calculate total progress
            // Each part contributes (1 / totalParts) to the total
            // But parts have different sizes (last one might be smaller)
            // More accurate: sum of bytes uploaded
            const totalUploadedBytes = partProgresses.reduce((acc, prog, idx) => {
              const partSize = (idx === totalParts - 1) ? (file.size - (idx * PART_SIZE)) : PART_SIZE;
              return acc + ((prog / 100) * partSize);
            }, 0);
            
            const totalProgress = (totalUploadedBytes / file.size) * 100;
            onProgress(totalProgress);
          }
        }));

        return { PartNumber: partNumber, ETag: etag };
      });

      // Sort parts by PartNumber just in case
      parts.sort((a, b) => a.PartNumber - b.PartNumber);

      await retry(() => completeMultipartUpload(config, fileName, uploadId, parts));
    } catch (error) {
      console.error('Multipart upload failed, aborting...', error);
      await retry(() => abortMultipartUpload(config, fileName, uploadId));
      throw error;
    }
  } else {
    // Single Upload
    const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
    const path = `/${config.bucketName}/${fileName}`;
    const url = `${endpoint}${path}`;

    const amzDate = getAmzDate();
    const fileBuffer = await file.arrayBuffer();
    const contentHash = await sha256(fileBuffer);

    const headers: Record<string, string> = {
      'Host': `${config.accountId}.r2.cloudflarestorage.com`,
      'X-Amz-Date': amzDate,
      'X-Amz-Content-Sha256': contentHash,
      'Content-Type': file.type || 'application/octet-stream',
    };

    const authorization = await createAwsSignature('PUT', path, headers, config, fileBuffer);
    headers['Authorization'] = authorization;

    await retry(() => uploadSmallFile(url, headers, fileBuffer, onProgress));
  }

  // Generate pre-signed URL for downloading (valid for 10 minutes)
  const downloadUrl = await generatePresignedUrl(fileName, config, 600);

  return { fileId: fileName, url: downloadUrl };
};

export const deleteFileFromR2 = async (fileId: string): Promise<void> => {
  const config = await getR2Config();
  
  if (!config) {
    throw new Error('R2 configuration not found.');
  }

  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${config.bucketName}/${fileId}`;
  const url = `${endpoint}${path}`;

  const amzDate = getAmzDate();

  const headers: Record<string, string> = {
    'Host': `${config.accountId}.r2.cloudflarestorage.com`,
    'X-Amz-Date': amzDate,
    'X-Amz-Content-Sha256': await sha256(''),
  };

  const authorization = await createAwsSignature('DELETE', path, headers, config, '');
  headers['Authorization'] = authorization;

  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
  }
};

export const putBucketCors = async (config: R2Config, allowedOrigins: string[]): Promise<void> => {
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${config.bucketName}`;
  const queryParams = { cors: '' };
  const url = `${endpoint}${path}?cors`;
  const amzDate = getAmzDate();

  const xmlBody = `
    <CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
      <CORSRule>
        ${allowedOrigins.map(origin => `<AllowedOrigin>${origin}</AllowedOrigin>`).join('')}
        <AllowedMethod>GET</AllowedMethod>
        <AllowedMethod>PUT</AllowedMethod>
        <AllowedMethod>POST</AllowedMethod>
        <AllowedMethod>DELETE</AllowedMethod>
        <AllowedMethod>HEAD</AllowedMethod>
        <AllowedHeader>*</AllowedHeader>
        <ExposeHeader>ETag</ExposeHeader>
        <MaxAgeSeconds>3000</MaxAgeSeconds>
      </CORSRule>
    </CORSConfiguration>
  `.trim();

  const headers: Record<string, string> = {
    'Host': `${config.accountId}.r2.cloudflarestorage.com`,
    'X-Amz-Date': amzDate,
    'Content-Type': 'application/xml',
    'X-Amz-Content-Sha256': await sha256(xmlBody),
  };

  const authorization = await createAwsSignature('PUT', path, headers, config, xmlBody, queryParams);
  headers['Authorization'] = authorization;

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: xmlBody,
  });

  if (!response.ok) {
    throw new Error(`Failed to set CORS policy: ${response.status} ${response.statusText}`);
  }
};

export const getBucketCors = async (config: R2Config): Promise<boolean> => {
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${config.bucketName}`;
  const queryParams = { cors: '' };
  const url = `${endpoint}${path}?cors`;
  const amzDate = getAmzDate();

  const headers: Record<string, string> = {
    'Host': `${config.accountId}.r2.cloudflarestorage.com`,
    'X-Amz-Date': amzDate,
    'X-Amz-Content-Sha256': await sha256(''),
  };

  const authorization = await createAwsSignature('GET', path, headers, config, '', queryParams);
  headers['Authorization'] = authorization;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (response.status === 404) {
      // No CORS configuration found
      return false;
    }

    if (!response.ok) {
      throw new Error(`Failed to get CORS policy: ${response.status} ${response.statusText}`);
    }

    // If we get a 200 OK, it means CORS is configured.
    // We could parse the XML to check specific rules, but for now just knowing it exists is enough.
    return true;
  } catch (error) {
    console.error('Error checking CORS:', error);
    return false;
  }
};

const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB
const PART_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CONCURRENT_PARTS = 3;

const retry = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000,
  backoff: number = 2
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * backoff, backoff);
  }
};

const runWithConcurrency = async <T>(
  items: any[],
  fn: (item: any, index: number) => Promise<T>,
  concurrency: number
): Promise<T[]> => {
  const results: T[] = new Array(items.length);
  const executing: Promise<void>[] = [];
  
  for (const [index, item] of items.entries()) {
    const p = Promise.resolve().then(() => fn(item, index)).then(result => {
      results[index] = result;
    });
    
    executing.push(p);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      // Note: Promise.race doesn't remove the promise, we need to manage the list.
      // A simpler way for this specific helper:
    }
    
    // Clean up executing array
    // This is a bit tricky without a proper pool implementation.
    // Let's use a simpler approach for the helper.
  }
  return Promise.all(executing).then(() => results);
};

// Better simple pool implementation
const asyncPool = async <T>(
  concurrency: number,
  items: any[],
  fn: (item: any, index: number) => Promise<T>
): Promise<T[]> => {
  const results: T[] = [];
  const executing: Promise<void>[] = [];
  
  for (const [index, item] of items.entries()) {
    const p = Promise.resolve().then(() => fn(item, index));
    results[index] = p as any; // Store promise temporarily
    
    const e = p.then((res) => {
      results[index] = res; // Replace with result
      executing.splice(executing.indexOf(e), 1);
    });
    executing.push(e);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
};


const uploadSmallFile = async (
  url: string,
  headers: Record<string, string>,
  body: ArrayBuffer,
  onProgress?: (progress: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(body);
  });
};

const initiateMultipartUpload = async (
  config: R2Config,
  fileName: string,
  contentType: string
): Promise<string> => {
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${config.bucketName}/${fileName}`;
  const url = `${endpoint}${path}?uploads`;
  const amzDate = getAmzDate();

  const headers: Record<string, string> = {
    'Host': `${config.accountId}.r2.cloudflarestorage.com`,
    'X-Amz-Date': amzDate,
    'Content-Type': contentType,
    'X-Amz-Content-Sha256': await sha256(''), // Empty payload for initiation
  };

  const authorization = await createAwsSignature('POST', path, headers, config, '', { uploads: '' });
  headers['Authorization'] = authorization;

  const response = await fetch(url, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to initiate multipart upload: ${response.statusText}`);
  }

  const text = await response.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "text/xml");
  const uploadId = xmlDoc.getElementsByTagName("UploadId")[0]?.textContent;

  if (!uploadId) {
    throw new Error('Failed to get UploadId from response');
  }

  return uploadId;
};

const uploadPart = async (
  config: R2Config,
  fileName: string,
  uploadId: string,
  partNumber: number,
  body: ArrayBuffer,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${config.bucketName}/${fileName}`;
  const queryParams = { partNumber: partNumber.toString(), uploadId };
  const url = `${endpoint}${path}?partNumber=${partNumber}&uploadId=${uploadId}`;
  const amzDate = getAmzDate();
  const contentHash = await sha256(body);

  const headers: Record<string, string> = {
    'Host': `${config.accountId}.r2.cloudflarestorage.com`,
    'X-Amz-Date': amzDate,
    'X-Amz-Content-Sha256': contentHash,
  };

  const authorization = await createAwsSignature('PUT', path, headers, config, body, queryParams);
  headers['Authorization'] = authorization;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag');
        if (etag) {
          resolve(etag);
        } else {
          reject(new Error('ETag not found in response'));
        }
      } else {
        reject(new Error(`Part upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during part upload'));
    xhr.send(body);
  });
};

const completeMultipartUpload = async (
  config: R2Config,
  fileName: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[]
): Promise<void> => {
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${config.bucketName}/${fileName}`;
  const queryParams = { uploadId };
  const url = `${endpoint}${path}?uploadId=${uploadId}`;
  const amzDate = getAmzDate();

  const xmlBody = `
    <CompleteMultipartUpload xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
      ${parts.map(p => `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag}</ETag></Part>`).join('')}
    </CompleteMultipartUpload>
  `;

  const headers: Record<string, string> = {
    'Host': `${config.accountId}.r2.cloudflarestorage.com`,
    'X-Amz-Date': amzDate,
    'Content-Type': 'application/xml',
    'X-Amz-Content-Sha256': await sha256(xmlBody),
  };

  const authorization = await createAwsSignature('POST', path, headers, config, xmlBody, queryParams);
  headers['Authorization'] = authorization;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: xmlBody,
  });

  if (!response.ok) {
    throw new Error(`Failed to complete multipart upload: ${response.statusText}`);
  }
};

const abortMultipartUpload = async (
  config: R2Config,
  fileName: string,
  uploadId: string
): Promise<void> => {
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${config.bucketName}/${fileName}`;
  const queryParams = { uploadId };
  const url = `${endpoint}${path}?uploadId=${uploadId}`;
  const amzDate = getAmzDate();

  const headers: Record<string, string> = {
    'Host': `${config.accountId}.r2.cloudflarestorage.com`,
    'X-Amz-Date': amzDate,
    'X-Amz-Content-Sha256': await sha256(''),
  };

  const authorization = await createAwsSignature('DELETE', path, headers, config, '', queryParams);
  headers['Authorization'] = authorization;

  await fetch(url, {
    method: 'DELETE',
    headers,
  });
};
