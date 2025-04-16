import { NextRequest, NextResponse } from "next/server";
import { Worker, Queue } from "bullmq";
import { exec } from "child_process";
import { promisify } from "util";
import fs from 'fs';
import path from 'path';
import os from 'os';
import { uploadToGCS, FileType } from "@/app/utils/storage";
import { generateAssContent, SubtitleStyle } from "@/app/utils/subtitle-utils";
import { 
  setVideoProcessingStatus, 
  getVideoProcessingStatus, 
  setVideoOutputLink, 
  VideoProcessingStatus 
} from "@/lib/redis_helper";

const execAsync = promisify(exec);
const writeFileAsync = promisify(fs.writeFile);

// Track worker instance globally
let worker: Worker | null = null;

// Create Redis connection
const redisConnection = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    // Add reconnection strategy
    retryStrategy: (times: number) => {
      // Exponential backoff with a max delay of 30 seconds
      const delay = Math.min(Math.pow(2, times) * 500, 30000);
      console.log(`BullMQ Redis reconnecting... attempt ${times} in ${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: 5,
    enableReadyCheck: true,
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Only reconnect on specific errors
        return true;
      }
      return false;
    }
  }
};

// Create queue with same connection
const videoProcessingQueue = new Queue('video-processing', redisConnection);


async function generateThumbnail(videoPath: string, uniqueId: string): Promise<string> {
  try {
    // Check if video file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }
    
    // Create thumbnail using ffmpeg
    const thumbnailPath = path.join(os.tmpdir(), `${uniqueId}.jpg`);
    const ffmpeg_command = `ffmpeg -i "${videoPath.replace(/\\/g, '/')}" -vf "thumbnail,scale=iw:ih" -frames:v 1 -y "${thumbnailPath.replace(/\\/g, '/')}"`;
    
    try {
      const { stderr } = await execAsync(ffmpeg_command);
      
      // Check if thumbnail was actually created
      if (!fs.existsSync(thumbnailPath)) {
        console.error(`ffmpeg stderr: ${stderr}`);
        throw new Error(`Failed to generate thumbnail: output file not created`);
      }
    } catch (error: any) {
      console.error(`ffmpeg error for ${uniqueId}:`, error);
      throw new Error(`Failed to execute ffmpeg: ${error.message || String(error)}`);
    }
    
    // Upload the thumbnail to GCS using the file path
    const thumbnailUrl = await uploadToGCS(
      thumbnailPath,
      FileType.IMAGE,
      uniqueId,
      `thumbnail-${uniqueId}.jpg`
    );
    
    // Clean up the local thumbnail file
    try {
      fs.unlinkSync(thumbnailPath);
    } catch (cleanupError) {
      console.error("Error cleaning up thumbnail file:", cleanupError);
    }
    
    return thumbnailUrl;
  } catch (error) {
    console.error(`Error generating thumbnail for video ${uniqueId}:`, error);
    throw error;
  }
}

// The actual video processing function
async function burnSubtitles(
  machineId: string,
  videoPath: string, 
  segments: any[], 
  uniqueId: string,
  subtitleFont: string,
  subtitlePosition: { y: number },
  subtitleColors: { 
    line1: { text: string, background: string }
  },
  subtitleSize: number
): Promise<string> {
  // Create temp directory for working files
  const tmpDir = path.join(os.tmpdir(), uniqueId);
  fs.mkdirSync(tmpDir, { recursive: true });
  
  // Path for subtitle file and output video
  const subtitlePath = path.join(tmpDir, `${uniqueId}.ass`);
  const outputVideoPath = path.join(tmpDir, `${uniqueId}_subtitled.mp4`);
  
  // Get video dimensions using ffprobe
  const { stdout: probeOutput } = await execAsync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${videoPath.replace(/\\/g, '/')}"`
  );
  const [width, height] = probeOutput.trim().split('x').map(Number);

  const thumbnailUrl = await generateThumbnail(videoPath, uniqueId);
  // Generate ASS subtitle content with video dimensions
  const subtitleStyle: SubtitleStyle = {
    font: subtitleFont,
    position: subtitlePosition,
    colors: subtitleColors,
    fontSize: subtitleSize
  };
  
  const assContent = await generateAssContent(
    segments,
    subtitleStyle,
    width,
    height
  );
  
  // Write subtitle file
  await writeFileAsync(subtitlePath, assContent);
  
  // Execute ffmpeg command
  const ffmpeg_command = `ffmpeg -y -i "${videoPath.replace(/\\/g, '/')}" -vf "ass='${subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:')}'" -c:v libx264 -preset fast -crf 18 -threads 0 -c:a copy "${outputVideoPath.replace(/\\/g, '/')}"`;
  await execAsync(ffmpeg_command);
  
  // Upload to GCS
  const buffer = await fs.promises.readFile(outputVideoPath);
  const file = new File([buffer], `${uniqueId}_subtitled.mp4`, { type: 'video/mp4' });
  const outputUrl = await uploadToGCS(
    file,
    FileType.VIDEO,
    uniqueId,
    `subtitled_video_${uniqueId}_file.mp4`
  );
  
  // Clean up temporary files
  try {
    const files = fs.readdirSync(tmpDir);
    
    for (const file of files) {
      fs.unlinkSync(path.join(tmpDir, file));
    }
    
    fs.rmdirSync(tmpDir);
  } catch (e) {
    console.error("Error cleaning up temp files:", e);
  }
  
  console.debug(`Subtitle added to video ${uniqueId} : ${outputUrl}`);
  
  // Update status in Redis
  const input_link = (await getVideoProcessingStatus(machineId, uniqueId))?.input_link;
  if (input_link) {
    await setVideoProcessingStatus(machineId, uniqueId, VideoProcessingStatus.COMPLETED, input_link, Date.now());
  }
  await setVideoOutputLink(machineId, uniqueId, input_link || "", outputUrl, thumbnailUrl, Date.now());
  
  return outputUrl;
}

export async function GET(req: NextRequest) {
  try {
    // Only start the worker if it's not already running
    if (!worker) {
      console.log('Starting video processing worker...');
      
      // Create a worker with concurrency of 2 (process 2 videos at once)
      worker = new Worker(
        'video-processing',
        async (job) => {
          console.log(`Processing job ${job.id}: ${job.name}`);
          
          const { 
            machineId, 
            videoPath, 
            segments, 
            uniqueId, 
            subtitleFont, 
            subtitlePosition, 
            subtitleColors, 
            subtitleSize 
          } = job.data;
          
          try {
            // Update progress
            await job.updateProgress(10);
            
            // Process the video
            const outputUrl = await burnSubtitles(
              machineId,
              videoPath,
              segments,
              uniqueId,
              subtitleFont,
              subtitlePosition,
              subtitleColors,
              subtitleSize
            );
            
            // Final progress update
            await job.updateProgress(100);
            
            return { success: true, outputUrl };
          } catch (error) {
            console.error(`Error processing video ${uniqueId}:`, error);
            
            // Update status to failed
            const input_link = (await getVideoProcessingStatus(machineId, uniqueId))?.input_link;
            if (input_link) {
              await setVideoProcessingStatus(machineId, uniqueId, VideoProcessingStatus.FAILED, input_link, Date.now());
            }
            
            throw error;
          }
        },
        { 
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            // Add reconnection strategy
            retryStrategy: (times: number) => {
              // Exponential backoff with a max delay of 30 seconds
              const delay = Math.min(Math.pow(2, times) * 500, 30000);
              console.log(`Worker Redis reconnecting... attempt ${times} in ${delay}ms`);
              return delay;
            },
            maxRetriesPerRequest: 5,
            enableReadyCheck: true,
            reconnectOnError: (err: Error) => {
              const targetError = 'READONLY';
              if (err.message.includes(targetError)) {
                // Only reconnect on specific errors
                return true;
              }
              return false;
            }
          },
          concurrency: 2, // Process 2 videos at the same time
          removeOnComplete: {
            count: 100 // Keep the last 100 completed jobs
          },
          removeOnFail: {
            count: 100 // Keep the last 100 failed jobs
          }
        }
      );
      
      // Set up event handlers
      worker.on('completed', (job) => {
        console.log(`Job ${job.id} completed successfully`);
      });
      
      worker.on('failed', (job, error) => {
        console.error(`Job ${job?.id} failed with error: ${error.message}`);
      });
      
      worker.on('error', (err) => {
        console.error('Worker error:', err);
      });

      return NextResponse.json(
        { message: "Video processing worker started", active: true },
        { status: 200 }
      );
    }
    
    return NextResponse.json(
      { message: "Video processing worker already running", active: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error starting worker:', error);
    return NextResponse.json(
      { error: "Failed to start video processing worker" },
      { status: 500 }
    );
  }
}

// Also handle POST requests to check status
export async function POST() {
  return NextResponse.json(
    { 
      workerActive: worker !== null,
      queueName: 'video-processing'
    },
    { status: 200 }
  );
}
