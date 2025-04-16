import { NextRequest, NextResponse } from 'next/server';
import { getMachineId } from '@/lib/identity';
import { 
  getAllProcessedVideos, 
  getAllProcessingVideos 
} from '@/lib/redis_helper';

export async function GET(request: NextRequest) {
  try {
    // Get the machine ID for the current user
    const machineId = getMachineId();
    
    // Fetch all processed videos
    const processedVideos = await getAllProcessedVideos(machineId);
    
    // Fetch all processing videos
    const processingVideos = await getAllProcessingVideos(machineId);
    
    // Sort both arrays by timestamp in descending order (newest first)
    processedVideos.sort((a, b) => b.timestamp - a.timestamp);
    processingVideos.sort((a, b) => b.timestamp - a.timestamp);
    
    // Return both sets of videos
    return NextResponse.json({
      success: true,
      processed: processedVideos,
      processing: processingVideos
    });
  } catch (error) {
    console.error('Error fetching user videos:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch videos' 
      },
      { status: 500 }
    );
  }
}
