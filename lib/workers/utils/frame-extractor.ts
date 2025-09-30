import type { VideoFile } from "@/types";

export async function extractFrames(
  videoFile: VideoFile,
  samplingRate: number
): Promise<ImageData[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;

    video.onloadedmetadata = () => {
      const frames: ImageData[] = [];
      const duration = video.duration;
      const frameInterval = 1 / samplingRate; // seconds between frames
      const totalFrames = Math.floor(duration * samplingRate);

      let currentFrame = 0;

      const captureFrame = () => {
        if (currentFrame >= totalFrames) {
          resolve(frames);
          return;
        }

        const timestamp = currentFrame * frameInterval;
        video.currentTime = timestamp;

        video.onseeked = () => {
          const canvas = new OffscreenCanvas(
            video.videoWidth,
            video.videoHeight
          );
          const ctx = canvas.getContext("2d");

          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const imageData = ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            );
            frames.push(imageData);
          }

          currentFrame++;
          setTimeout(captureFrame, 0); // Allow other tasks to run
        };
      };

      captureFrame();
    };

    video.onerror = () => {
      reject(new Error("Failed to load video"));
    };

    video.src = videoFile.url;
  });
}
