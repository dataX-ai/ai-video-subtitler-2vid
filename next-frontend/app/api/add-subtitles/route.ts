import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import { uploadToGCS, FileType } from "../../utils/storage"
import fs from 'fs'
import path from 'path'
import os from 'os'
import withAPIMetrics from "@/hooks/use-metrics";
import { getMachineId } from "@/lib/identity";
import { setVideoProcessingStatus, VideoProcessingStatus } from "@/lib/redis_helper";
import { Queue } from "bullmq";

const execAsync = promisify(exec)
const writeFileAsync = promisify(fs.writeFile)

// Create BullMQ queue for video processing
const videoProcessingQueue = new Queue('video-processing', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  }
});

// Worker function moved to /api/worker/route.ts

class SubtitleRouteHandler {

  static async POST(req: NextRequest) {
    
    try {
  
      const formData = await req.formData()
      const video = formData.get("video") as File
      const audioUrl = formData.get("audioUrl") as string
      const transcription = formData.get("transcription") as string
      const segments = JSON.parse(formData.get("segments") as string)
      const uniqueId = formData.get("uniqueId") as string
      const subtitleFont = formData.get("subtitleFont") as string
      const subtitlePosition = JSON.parse(formData.get("subtitlePosition") as string)
      const subtitleColors = JSON.parse(formData.get("subtitleColors") as string)
      const subtitleSize = parseInt(formData.get("subtitleSize") as string)

      const machineId = getMachineId()

      if (!video || !transcription) {
        return NextResponse.json({ error: "Video and transcription are required" }, { status: 400 })
      }

      const input_link = await uploadToGCS(video, FileType.VIDEO, uniqueId)
      await setVideoProcessingStatus(machineId, uniqueId, VideoProcessingStatus.PROCESSING, input_link, Date.now())
      
      // Save the video to a temporary file
      const tmpDir = path.join(os.tmpdir(), uniqueId)
      fs.mkdirSync(tmpDir, { recursive: true })
      const videoPath = path.join(tmpDir, `${uniqueId}_original.mp4`)
      
      // Convert File object to buffer and write to disk
      const arrayBuffer = await video.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await fs.promises.writeFile(videoPath, buffer)
      
      // Start the worker if it's not already running
      try {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/worker`, { method: 'GET' }).catch(error => {
          console.error('Error triggering worker:', error);
        });
      } catch (error) {
        console.error('Error starting worker:', error);
      }
      
      // Add job to queue instead of processing directly
      await videoProcessingQueue.add('burn-subtitles', {
        machineId,
        videoPath,
        segments,
        uniqueId,
        subtitleFont,
        subtitlePosition,
        subtitleColors,
        subtitleSize
      }, {
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      });
      
      // Return immediately with 204 No Content
      return NextResponse.json({
        status: "processing", 
        message: "Video processing started",
        videoId: uniqueId
      });
    } catch (error) {
      console.error("ERROR: add-subtitles :: Error parsing form data:", error)
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }
  }
}

export const POST = withAPIMetrics(SubtitleRouteHandler.POST);


