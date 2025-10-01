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
- ✅ Tooltips and help system
- ✅ Video quality checker
- ✅ Performance monitoring
- ✅ Test infrastructure and evaluation framework
- 🚧 AI model integration (in progress)
- 🚧 Event detection algorithms (in progress)
- 🚧 Performance optimization (in progress)

## Testing

The application includes a comprehensive testing framework for evaluating detection accuracy:

### Running Tests

```bash
# Run test evaluation suite
npm run test:eval

# Run with specific configuration
npm run test:eval -- --verbose
```

### Test Coverage

- **Annotated test clips** with ground truth data
- **Accuracy metrics**: Precision, recall, F1 scores for all event types
- **Performance benchmarks**: Processing time and memory usage
- **Quality thresholds**: Score OCR ≥95%, Team attribution ≥80%, Shot inference ≥60%

See [TESTING.md](./TESTING.md) for detailed testing documentation.

## Performance

The application is optimized for client-side processing:

- **Web Workers** isolate heavy computation from UI thread
- **Lazy model loading** reduces initial bundle size
- **Device capability detection** auto-adjusts settings
- **Quality checker** warns about suboptimal footage
- **Configurable sampling rates** balance accuracy vs. speed

### Performance Targets

- Process 2-minute 1080p clip at 1 FPS without freezing UI
- Models loaded lazily on demand
- Responsive design for all screen sizes
- Export functionality works for large datasets

## Help & Documentation

Click the help button (?) in the bottom-right corner of the app for:

- **Quick Start Guide**: Step-by-step usage instructions
- **FAQ & Troubleshooting**: Common issues and solutions
- **Privacy Information**: Data handling and security details

## License

MIT License
