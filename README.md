# Basketball Quick Stats

AI-powered basketball game analysis tool for extracting statistics from video footage.

## Features

- **Video Analysis**: Upload MP4 videos and extract game statistics automatically
- **Scoreboard OCR**: Crop and read scoreboard to track score changes
- **Player Detection**: Detect players and cluster them into teams
- **Event Detection**: Identify shots, rebounds, turnovers, and other game events
- **Interactive Timeline**: Click on events to seek to specific moments in the video
- **Data Export**: Export results as JSON or CSV files

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **AI/ML**: TensorFlow.js, MediaPipe, Tesseract.js
- **Charts**: Recharts for data visualization
- **Processing**: Web Workers for heavy computation
- **Styling**: Tailwind CSS

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the development server:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Upload Video**: Select an MP4 video file (up to 500MB)
2. **Crop Scoreboard**: Draw a rectangle around the scoreboard area
3. **Configure Analysis**: Choose sampling rate and enable advanced features
4. **Start Analysis**: The system will process the video and extract statistics
5. **Review Results**: View timeline, charts, and event details
6. **Export Data**: Download results as JSON or CSV

## Recommended Video Quality

- Resolution: 720p or higher
- Clear, steady footage (avoid shaky camera)
- Good lighting conditions
- Visible scoreboard in the frame
- Duration: 2-10 minutes for best results

## Architecture

The application uses a client-side processing approach:

- **Main Thread**: UI components and user interaction
- **Web Workers**: Heavy AI/ML processing (person detection, OCR, pose estimation)
- **Models**: Pre-trained models for object detection and pose estimation
- **Event Fusion**: Rule-based system to combine detection results into game events

## Development Status

This is a work in progress. Current implementation includes:

- ✅ Basic UI and video player
- ✅ Video upload and frame extraction
- ✅ Scoreboard cropping tool
- ✅ Processing controls and progress tracking
- ✅ Results display with charts and timeline
- 🚧 AI model integration (in progress)
- 🚧 Event detection algorithms (in progress)
- 🚧 Performance optimization (in progress)

## License

MIT License
