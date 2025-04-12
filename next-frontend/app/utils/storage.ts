import { Storage } from '@google-cloud/storage'
import fs from "fs"
import path from "path"
import { tmpdir, type } from 'os'

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || ''

export enum FileType {
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image'
}

export function getGCSUrl(fileName: string) {
  return `https://storage.googleapis.com/${bucketName}/${fileName}`
}

export function getGCSfilename(type: FileType, uniqueId: string, extension: string) {
  return `${type}-${uniqueId}${extension}`
}

export async function uploadToGCS(file: Blob | string, type: FileType, uniqueId:string, name?: string): Promise<string> {
  // Initialize Google Cloud Storage

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS || !process.env.GOOGLE_CLOUD_PROJECT_ID || !process.env.GOOGLE_CLOUD_BUCKET_NAME) {
    throw new Error('Google Credentials are not set')
  }

  const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))
  })
  
  const bucket = storage.bucket(bucketName)
  
  // Determine file extension and content type based on file type
  let extension: string;
  let contentType: string;
  
  if (type === 'video') {
    extension = '.mp4';
    contentType = 'video/mp4';
  } else if (type === 'audio') {
    extension = '.mp3';
    contentType = 'audio/mp3';
  } else if (type === 'image') {
    extension = '.jpg'; // Default to jpg, could be expanded to handle different image types
    contentType = 'image/jpeg';
  } else {
    throw new Error(`Unsupported file type: ${type}`);
  }
  
  const filename = name || getGCSfilename(type, uniqueId, extension)
  let tempFilePath: string;
  let shouldCleanupTemp = false;
  
  // Handle file path or Blob
  if (typeof file === 'string') {
    // If file is a path string, use it directly
    tempFilePath = file;
  } else {
    // If file is a Blob, save to temp location
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    tempFilePath = path.join(tmpdir(), filename);
    fs.writeFileSync(tempFilePath, buffer);
    shouldCleanupTemp = true;
    console.log(`Temp file saved to ${tempFilePath}`);
  }
  
  try {
    // Upload file to Google Cloud Storage
    await bucket.upload(tempFilePath, {
      destination: filename,
      metadata: {
        contentType: contentType,
      },
    })

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${filename}`
    return publicUrl
  } finally {
    // Clean up temporary file only if we created it
    if (shouldCleanupTemp) {
      fs.unlinkSync(tempFilePath)
    }
  }
}


