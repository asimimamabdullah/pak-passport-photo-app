import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

const PassportPhotoEditor = () => {
    const originalCanvasRef = useRef(null);
    const croppedCanvasRef = useRef(null);
    const [originalImage, setOriginalImage] = useState(null);
    const [faceDetection, setFaceDetection] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [offsetX, setOffsetX] = useState(0); // Manual X offset
    const [offsetY, setOffsetY] = useState(0); // Manual Y offset
    const [zoom, setZoom] = useState(1); // Zoom level (1 = 100%)
    const [headHeightMm, setHeadHeightMm] = useState(34); // Desired head height in mm

    useEffect(() => {
        const loadModels = async () => {
            try {
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
                    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                ]);
                setIsLoading(false);
            } catch (err) {
                console.error("Model load error:", err);
                alert("Failed to load face detection models. Please check the /models directory.");
            }
        };
        loadModels();
    }, []);

    const handleImageUpload = async (event) => {
        setFaceDetection(null);
        setOriginalImage(null);
        const file = event.target.files[0];
        if (!file) return;

        const imageURL = URL.createObjectURL(file);
        const img = new Image();
        img.src = imageURL;
        img.onload = async () => {
            setOriginalImage(img);

            const canvas = originalCanvasRef.current;
            if (!canvas) return;

            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, img.width, img.height);

            if (!faceapi.nets.tinyFaceDetector.isLoaded) {
                alert("Face detection model not loaded yet. Please wait.");
                return;
            }

            const detectionOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.3 });
            const detection = await faceapi.detectSingleFace(canvas, detectionOptions).withFaceLandmarks();

            if (detection) {
                setFaceDetection(detection);
            } else {
                alert("No face detected. Please upload another photo.");
            }
        };

        img.onerror = () => {
            alert("Error loading image. Please try another image file.");
        };
    };

    const handleCropAndDownload = () => {
        if (!originalImage || !faceDetection) {
            alert("Please upload an image and ensure a face is detected.");
            return;
        }

        const originalCanvas = originalCanvasRef.current;
        const croppedCanvas = croppedCanvasRef.current;
        if (!originalCanvas || !croppedCanvas) return;

        const faceBox = faceDetection.detection.box;
        const faceWidth = faceBox.width;
        const faceHeight = faceBox.height;

        // Convert mm to pixels (300 DPI)
        const dpi = 300;
        const passportWidthPx = Math.round((35 / 25.4) * dpi);
        const passportHeightPx = Math.round((45 / 25.4) * dpi);

        // Calculate scale factor based on desired head height
        const scaleFactor = headHeightMm / faceHeight;

        // Calculate target pixel dimensions for the final passport photo
        const targetWidthPx = passportWidthPx;
        const targetHeightPx = passportHeightPx;

        // Calculate cropping region
        const cropWidth = targetWidthPx / zoom;
        const cropHeight = targetHeightPx / zoom;
        let startX = faceBox.x + offsetX - (cropWidth - faceWidth) / 2;
        let startY = faceBox.y + offsetY;

        // Clamp cropping region to image boundaries
        startX = Math.max(0, Math.min(startX, originalCanvas.width - cropWidth));
        startY = Math.max(0, Math.min(startY, originalCanvas.height - cropHeight));

        // Set cropped canvas dimensions
        croppedCanvas.width = passportWidthPx;
        croppedCanvas.height = passportHeightPx;

        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCtx.drawImage(
            originalCanvas,
            startX, startY, cropWidth, cropHeight, // Source region
            0, 0, passportWidthPx, passportHeightPx // Destination region
        );

        // Create download link
        const dataURL = croppedCanvas.toDataURL('image/jpeg');
        const downloadLink = document.createElement('a');
        downloadLink.href = dataURL;
        downloadLink.download = 'passport-photo.jpg';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(dataURL);
    };

    const updatePreview = () => {
        if (!originalImage || !faceDetection) return;

        const originalCanvas = originalCanvasRef.current;
        const croppedCanvas = croppedCanvasRef.current;
        if (!originalCanvas || !croppedCanvas) return;

        const faceBox = faceDetection.detection.box;
        const faceWidth = faceBox.width;
        const faceHeight = faceBox.height;

        // Convert mm to pixels (300 DPI)
        const dpi = 300;
        const passportWidthPx = Math.round((35 / 25.4) * dpi);
        const passportHeightPx = Math.round((45 / 25.4) * dpi);

        // Calculate scale factor based on desired head height
        const scaleFactor = headHeightMm / faceHeight;

        // Calculate target pixel dimensions for the final passport photo
        const targetWidthPx = passportWidthPx;
        const targetHeightPx = passportHeightPx;

        // Calculate cropping region
        const cropWidth = targetWidthPx / zoom;
        const cropHeight = targetHeightPx / zoom;
        let startX = faceBox.x + offsetX - (cropWidth - faceWidth) / 2;
        let startY = faceBox.y + offsetY;

        // Clamp cropping region to image boundaries
        startX = Math.max(0, Math.min(startX, originalCanvas.width - cropWidth));
        startY = Math.max(0, Math.min(startY, originalCanvas.height - cropHeight));

        // Set cropped canvas dimensions
        croppedCanvas.width = passportWidthPx;
        croppedCanvas.height = passportHeightPx;

        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCtx.drawImage(
            originalCanvas,
            startX, startY, cropWidth, cropHeight, // Source region
            0, 0, passportWidthPx, passportHeightPx // Destination region
        );
    };

    return (
        <div>
            <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isLoading}
                style={{ display: 'block', margin: '20px auto' }}
            />
            {isLoading && <p>Loading face detection models...</p>}
            <div className="preview-container">
                <div className="preview-box">
                    <h3>Original Image</h3>
                    <div className="image-container" style={{ position: 'relative' }}>
                        <canvas ref={originalCanvasRef} style={{ maxWidth: '100%', height: 'auto' }} />
                        {faceDetection && (
                            <div
                                className="face-overlay"
                                style={{
                                    position: 'absolute',
                                    left: `${faceDetection.detection.box.x}px`,
                                    top: `${faceDetection.detection.box.y}px`,
                                    width: `${faceDetection.detection.box.width}px`,
                                    height: `${faceDetection.detection.box.height}px`,
                                    border: '2px solid red',
                                    boxSizing: 'border-box',
                                    pointerEvents: 'none',
                                }}
                            ></div>
                        )}
                    </div>
                </div>
                <div className="preview-box">
                    <h3>Cropped Passport Photo (35mm x 45mm)</h3>
                    <canvas ref={croppedCanvasRef} style={{ border: '1px solid black', maxWidth: '100%' }} />
                </div>
            </div>
            {faceDetection && (
                <div className="controls">
                    <label>
                        Head Height (mm):
                        <input
                            type="number"
                            value={headHeightMm}
                            onChange={(e) => setHeadHeightMm(Number(e.target.value))}
                            min="30"
                            max="40"
                            step="1"
                        />
                    </label>
                    <label>
                        X Offset (px):
                        <input
                            type="range"
                            value={offsetX}
                            onChange={(e) => setOffsetX(Number(e.target.value))}
                            min="-200"
                            max="200"
                            step="1"
                        />
                        {offsetX}px
                    </label>
                    <label>
                        Y Offset (px):
                        <input
                            type="range"
                            value={offsetY}
                            onChange={(e) => setOffsetY(Number(e.target.value))}
                            min="-200"
                            max="200"
                            step="1"
                        />
                        {offsetY}px
                    </label>
                    <label>
                        Zoom:
                        <input
                            type="range"
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            min="0.5"
                            max="2"
                            step="0.1"
                        />
                        {zoom.toFixed(1)}x
                    </label>
                    <button onClick={updatePreview}>Update Preview</button>
                </div>
            )}
            <div className="button-group">
                <button onClick={handleCropAndDownload} disabled={!faceDetection || isLoading}>
                    Crop & Download Passport Photo
                </button>
            </div>
        </div>
    );
};

export default PassportPhotoEditor;