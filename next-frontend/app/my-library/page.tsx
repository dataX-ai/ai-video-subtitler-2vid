"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaSpinner, FaClock, FaSync, FaArrowLeft } from 'react-icons/fa';

interface VideoItem {
  videoId: string;
  input_link: string;
  output_link?: string;
  thumbnail_link?: string;
  timestamp?: string;
}

interface VideoData {
  processed: VideoItem[];
  processing: VideoItem[];
}

export default function MyLibrary() {
  const [videos, setVideos] = useState<VideoData>({
    processed: [],
    processing: []
  });
  const [loading, setLoading] = useState(true);
  const placeholderThumbnail = "https://storage.googleapis.com/2vid-temp-video-bckt/thubnail.jpg";
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

  const handleRefresh = () => {
    // Reset polling counter
    pollCountRef.current = 0;
    
    // Show loading spinner
    setLoading(true);
    
    // Fetch videos again
    fetchVideos();
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
    if (videos.processing.length > 0 && !pollingIntervalRef.current) {
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
      if (pollingIntervalRef.current && videos.processing.length === 0) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        pollCountRef.current = 0;
      }
    };
  }, [videos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex justify-center items-center">
        <FaSpinner className="animate-spin text-indigo-500 text-4xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/" className="text-indigo-400 hover:text-indigo-300 mr-4">
            <FaArrowLeft className="text-xl" />
          </Link>
          <h1 className="text-3xl font-bold text-white">My Library</h1>
        </div>

        {/* No videos message */}
        {(videos.processed.length === 0 && videos.processing.length === 0) && (
          <div className="text-center py-12">
            <p className="text-lg text-gray-400">You don't have any videos yet.</p>
            <Link href="/" className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
              Add a video
            </Link>
          </div>
        )}

        {/* Processing Videos Section */}
        {videos.processing.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse mr-2"></div>
                <h2 className="text-xl font-semibold text-white">Processing</h2>
              </div>
              <button 
                onClick={handleRefresh}
                className="text-indigo-400 hover:text-indigo-300 p-2 rounded-full hover:bg-indigo-900/30 transition-colors"
                aria-label="Refresh videos"
              >
                <FaSync className={loading ? "animate-spin" : ""} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.processing.map((video) => (
                <div key={video.videoId} className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
                  <div className="relative h-40 w-full">
                    <Image 
                      src={placeholderThumbnail}
                      alt="Processing video"
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <FaSpinner className="animate-spin text-indigo-400 text-3xl" />
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center text-gray-400 mb-2">
                      <FaClock className="mr-2" />
                      <span>Processing...</span>
                    </div>
                    <h3 className="text-gray-300 text-lg truncate">{video.videoId}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processed Videos Section */}
        {videos.processed.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-white">Completed</h2>
              <button 
                onClick={handleRefresh}
                className="text-indigo-400 hover:text-indigo-300 p-2 rounded-full hover:bg-indigo-900/30 transition-colors"
                aria-label="Refresh videos"
              >
                <FaSync className={loading ? "animate-spin" : ""} />
              </button>
            </div>
            
            {/* Warning message */}
            <p className="text-amber-400 text-xs mb-4">Please download your videos within 7 days, after that they will be deleted.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.processed.map((video) => (
                <div key={video.videoId} className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-indigo-600 transition-colors">
                  <Link href={video.output_link || video.input_link || '#'}>
                    <div className="relative h-40 w-full">
                      <Image 
                        src={video.thumbnail_link || placeholderThumbnail}
                        alt="Video thumbnail"
                        fill
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center text-gray-400 mb-2">
                        <FaClock className="mr-2" />
                        {video.timestamp ? (
                          <span>{new Date(video.timestamp).toLocaleString()}</span>
                        ) : (
                          <span>Timestamp unavailable</span>
                        )}
                      </div>
                      <h3 className="text-gray-300 text-lg truncate">{video.videoId}</h3>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 