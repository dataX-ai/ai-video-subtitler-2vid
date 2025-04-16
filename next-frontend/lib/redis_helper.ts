import { deleteRedisValue, getRedisValue, setRedisValue, getRedisKeys } from "./redis";

export enum VideoProcessingStatus {
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export async function setVideoProcessingStatus(machineId: string, videoId: string, status: VideoProcessingStatus, input_link: string, timestamp: number) {
  const key = `machine:${machineId}:video:${videoId}:status`;
  await setRedisValue(key, { status, input_link, timestamp }, 60 * 60 * 1);
}

export async function getVideoProcessingStatus(machineId: string, videoId: string): Promise<{ status: string, input_link: string, timestamp: number } | null> {
  const key = `machine:${machineId}:video:${videoId}:status`;
  return await getRedisValue<{ status: string, input_link: string, timestamp: number}>(key);
}


export async function deleteVideoProcessingStatus(machineId: string, videoId: string) {
  const key = `machine:${machineId}:video:${videoId}:status`;
  await deleteRedisValue(key);
}

export async function setVideoOutputLink(machineId: string, videoId: string, input_link: string, output_link: string, thumbnail_link: string, timestamp: number) {
  const key = `machine:${machineId}:video:${videoId}:output_link`;
  await setRedisValue(key, { input_link, output_link, thumbnail_link, timestamp }, 60 * 60 * 24 * 7);
}

export async function getVideoOutputLink(machineId: string, videoId: string): Promise<{ input_link: string, output_link: string, thumbnail_link: string, timestamp: number } | null> {
  const key = `machine:${machineId}:video:${videoId}:output_link`;
  return await getRedisValue<{ input_link: string, output_link: string, thumbnail_link: string, timestamp: number }>(key);
}

export async function getAllProcessedVideos(machineId: string): Promise<Array<{ videoId: string, input_link: string, output_link: string, thumbnail_link: string, timestamp: number }>> {
  const pattern = `machine:${machineId}:video:*:output_link`;
  const keys = await getRedisKeys(pattern);
  const results = [];
  
  for (const key of keys) {
    const videoId = key.split(':')[3]; // Extract videoId from the key pattern
    const data = await getRedisValue<{ input_link: string, output_link: string, thumbnail_link: string, timestamp: number }>(key);
    if (data) {
      results.push({
        videoId,
        input_link: data.input_link,
        output_link: data.output_link,
        thumbnail_link: data.thumbnail_link,
        timestamp: data.timestamp
      });
    }
  }
  
  return results;
}

export async function getAllProcessingVideos(machineId: string): Promise<Array<{ videoId: string, input_link: string, timestamp: number }>> {
  const pattern = `machine:${machineId}:video:*:status`;
  const keys = await getRedisKeys(pattern);
  const results = [];
  
  for (const key of keys) {
    const videoId = key.split(':')[3]; // Extract videoId from the key pattern
    const data = await getRedisValue<{ status: string, input_link: string, timestamp: number }>(key);
    if (data && data.status === VideoProcessingStatus.PROCESSING) {
      results.push({
        videoId,
        input_link: data.input_link,
        timestamp: data.timestamp
      });
    }
  }
  
  return results;
}




