'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Check, X, Crop } from 'lucide-react'
import type { VideoFile } from '@/types'

interface ScoreboardCropToolProps {
  videoFile: VideoFile
  onCropComplete: (region: { x: number; y: number; width: number; height: number }) => void
  onCancel: () => void
}

export function ScoreboardCropTool({ videoFile, onCropComplete, onCancel }: ScoreboardCropToolProps) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [cropRegion, setCropRegion] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setStartPoint({ x, y })
    setIsDrawing(true)
    setCropRegion(null)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top

    const x = Math.min(startPoint.x, currentX)
    const y = Math.min(startPoint.y, currentY)
    const width = Math.abs(currentX - startPoint.x)
    const height = Math.abs(currentY - startPoint.y)

    setCropRegion({ x, y, width, height })
    drawCropRegion(x, y, width, height)
  }, [isDrawing, startPoint])

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false)
    setStartPoint(null)
  }, [])

  const drawCropRegion = useCallback((x: number, y: number, width: number, height: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw crop region
    ctx.clearRect(x, y, width, height)

    // Draw border
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, width, height)

    // Draw corner handles
    const handleSize = 8
    ctx.fillStyle = '#3b82f6'
    ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize)
    ctx.fillRect(x + width - handleSize/2, y - handleSize/2, handleSize, handleSize)
    ctx.fillRect(x - handleSize/2, y + height - handleSize/2, handleSize, handleSize)
    ctx.fillRect(x + width - handleSize/2, y + height - handleSize/2, handleSize, handleSize)
  }, [])

  const handleConfirm = useCallback(() => {
    if (cropRegion) {
      onCropComplete(cropRegion)
    }
  }, [cropRegion, onCropComplete])

  const handleReset = useCallback(() => {
    setCropRegion(null)
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }, [])

  // Update canvas size when video loads
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const updateCanvasSize = () => {
      const videoWidth = video.videoWidth
      const videoHeight = video.videoHeight
      const containerWidth = video.clientWidth
      const containerHeight = video.clientHeight

      // Calculate scale to fit video in container
      const scaleX = containerWidth / videoWidth
      const scaleY = containerHeight / videoHeight
      const scale = Math.min(scaleX, scaleY)

      canvas.width = videoWidth * scale
      canvas.height = videoHeight * scale
      canvas.style.width = `${videoWidth * scale}px`
      canvas.style.height = `${videoHeight * scale}px`
    }

    if (video.videoWidth > 0) {
      updateCanvasSize()
    } else {
      video.addEventListener('loadedmetadata', updateCanvasSize)
      return () => video.removeEventListener('loadedmetadata', updateCanvasSize)
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Crop Scoreboard Region</h3>
        <p className="text-muted-foreground">
          Click and drag to select the area containing the scoreboard for OCR analysis
        </p>
      </div>

      <div className="relative max-w-4xl mx-auto">
        <video
          ref={videoRef}
          src={videoFile.url}
          className="w-full h-auto max-h-[60vh]"
          muted
          loop
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm border border-muted-foreground rounded-lg hover:bg-muted transition-colors"
        >
          Reset
        </button>
        
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-muted-foreground rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>

        <button
          onClick={handleConfirm}
          disabled={!cropRegion}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          Confirm Crop
        </button>
      </div>

      {cropRegion && (
        <div className="text-center text-sm text-muted-foreground">
          Selected region: {Math.round(cropRegion.width)} × {Math.round(cropRegion.height)} pixels
        </div>
      )}
    </div>
  )
}
