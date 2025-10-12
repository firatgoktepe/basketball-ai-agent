MoveNet Model Directory

External model URLs are not accessible due to CORS/403 issues.
The app will automatically use fallback pose detection strategies:
1. createWorkingModel() - Creates a simple CNN for basic pose detection
2. createSimplifiedModel() - Creates a lightweight fallback model  
3. Mock model - Generates test poses for development

For better accuracy, manually download MoveNet model files:
1. Visit: https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4
2. Download model.json and weight files
3. Place them in this directory
4. The app will automatically use them if present
