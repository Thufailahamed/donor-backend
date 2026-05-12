import { BlobServiceClient } from '@azure/storage-blob';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'voicenotes';

let containerClient: any = null;

if (connectionString) {
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    // Initialize default container
    containerClient = blobServiceClient.getContainerClient(containerName);
    containerClient.createIfNotExists({ access: 'blob' })
      .then(() => console.log(`Azure Container "${containerName}" is ready.`))
      .catch((err: any) => console.error('Error creating default Azure container:', err.message));
  } catch (error: any) {
    console.error('Azure Storage init error:', error.message);
  }
}

/**
 * Uploads a file to Azure Blob Storage
 * @param filePath Path to the local file
 * @param originalName Original filename to preserve extension
 * @param targetContainer Optional container name (defaults to env var)
 * @returns The public URL of the uploaded blob
 */
export const uploadToAzure = async (filePath: string, originalName: string, targetContainer?: string): Promise<string> => {
  if (!connectionString) {
    throw new Error('Azure Storage connection string is missing.');
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const selectedContainer = targetContainer || containerName;
  const client = blobServiceClient.getContainerClient(selectedContainer);
  
  await client.createIfNotExists({ access: 'blob' });

  const blobName = `${uuidv4()}${path.extname(originalName)}`;
  const blockBlobClient = client.getBlockBlobClient(blobName);
  
  await blockBlobClient.uploadFile(filePath);
  
  return blockBlobClient.url;
};

/**
 * Deletes a blob from Azure Storage
 * @param blobUrl The full URL of the blob to delete
 */
export const deleteFromAzure = async (blobUrl: string): Promise<void> => {
  if (!connectionString) return;

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    // URL format: https://account.blob.core.windows.net/container/blobname
    const urlParts = new URL(blobUrl);
    const pathParts = urlParts.pathname.split('/').filter(Boolean);
    
    if (pathParts.length < 2) return;
    
    const targetContainer = pathParts[0];
    const blobName = pathParts.slice(1).join('/');
    
    const client = blobServiceClient.getContainerClient(targetContainer);
    const blockBlobClient = client.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
  } catch (error: any) {
    console.error('Azure Delete error:', error.message);
  }
};

