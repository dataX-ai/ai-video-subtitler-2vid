"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface VideoData {
  processed: Array<{
    videoId: string;
    input_link: string;
    output_link: string;
    thumbnail_link: string;
  }>;
  processing: Array<{
    videoId: string;
    input_link: string;
  }>;
}

const MyVideoPreview = () => {
  const [videos, setVideos] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const pollCountRef = useRef(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/my-videos');
      const data = await response.json();
      
      if (data.success) {
        setVideos({
          processed: data.processed || [],
          processing: data.processing || []
        });

        // If we have processing videos, continue polling
        if (data.processing && data.processing.length > 0) {
          pollCountRef.current += 1;
        } else if (pollingIntervalRef.current) {
          // No more processing videos, stop polling
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          pollCountRef.current = 0;
        }

        // If we've reached max poll count, stop polling
        if (pollCountRef.current >= 60 && pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          pollCountRef.current = 0;
        }
      }
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchVideos();

    return () => {
      // Clean up interval on component unmount
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Set up polling when videos state changes
  useEffect(() => {
    // If we have processing videos and no interval is set, start polling
    if (videos?.processing.length && !pollingIntervalRef.current) {
      pollCountRef.current = 1; // Initial fetch counts as first poll
      pollingIntervalRef.current = setInterval(() => {
        if (pollCountRef.current < 60) {
          fetchVideos();
        } else {
          // Max poll count reached
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            pollCountRef.current = 0;
          }
        }
      }, 15000); // Poll every 15 seconds
    }

    return () => {
      if (pollingIntervalRef.current && (!videos || videos.processing.length === 0)) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        pollCountRef.current = 0;
      }
    };
  }, [videos]);

  // Don't render anything if still loading or no videos found
  if (loading) return null;
  if (!videos || (videos.processed.length === 0 && videos.processing.length === 0)) {
    return null;
  }

  return (
    <Link href="/my-library">
      <div className="w-full rounded-xl border border-indigo-800/30 overflow-hidden bg-gradient-to-br from-gray-900/95 via-indigo-950/90 to-gray-900/95 p-4 cursor-pointer hover:border-indigo-700/50 transition-all">
        {/* Title */}
        <h2 className="text-xl font-semibold text-white mb-3">My Library</h2>
        
        {/* Processing Videos Section */}
        {videos.processing.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse mr-2"></div>
              <p className="text-indigo-300 font-medium">
                {videos.processing.length} {videos.processing.length === 1 ? 'video' : 'videos'} currently processing
              </p>
            </div>
          </div>
        )}

        {/* Processed Videos Thumbnails */}
        {videos.processed.length > 0 && (
          <div className="mt-2">
            <p className="text-gray-300 mb-2 text-sm">Recently processed:</p>
            <div className="flex space-x-2">
              {videos.processed.slice(0, 6).map((video) => (
                <div key={video.videoId} className="relative w-24 h-16 rounded-md overflow-hidden">
                  {video.thumbnail_link ? (
                    <Image 
                      src={video.thumbnail_link} 
                      alt="Video thumbnail" 
                      fill 
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <span className="text-gray-500 text-xs">No preview</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
};

export default MyVideoPreview;
