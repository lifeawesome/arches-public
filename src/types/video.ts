/**
 * Type definitions for video uploads and Arches Video API integration
 */

export interface VideoData {
  videoId: string;
  url: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  status: "uploading" | "processing" | "ready" | "error";
  fileName: string;
  fileSize: number;
  createdAt?: string;
}

export interface VideoMetadata {
  width?: number;
  height?: number;
  codec?: string;
  bitrate?: number;
  fps?: number;
}

export interface VideoUploadOptions {
  apiUrl?: string;
  authToken?: string;
  maxFileSize?: number;
  allowedFormats?: string[];
}
