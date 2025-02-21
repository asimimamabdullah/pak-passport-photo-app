import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

// Constants for Passport Photo Requirements and UI
const PASSPORT_DPI = 600;
const PASSPORT_WIDTH_MM = 35;
const PASSPORT_HEIGHT_MM = 45;
const HEAD_HEIGHT_MIN_MM = 32;
const HEAD_HEIGHT_MAX_MM = 36;
const TOP_MARGIN_MM = 3.5;
const EYE_ANGLE_TOLERANCE_DEGREES = 10;
const MIN_IMAGE_RESOLUTION = 600;
const MODEL_URI = '/models'; // Define model URI once
const ZOOM_STEP = 0.01; // Step for zoom buttons and range input
const VERTICAL_STEP = 1; // Step for vertical move buttons and range input
const HORIZONTAL_STEP = 1; // Step for horizontal move buttons and range input
const MAX_VERTICAL_OFFSET = 50; // Maximum vertical offset in pixels (adjust as needed)
const MIN_VERTICAL_OFFSET = -50; // Minimum vertical offset in pixels (adjust as needed)
const MAX_HORIZONTAL_OFFSET = 50; // Maximum horizontal offset in pixels (adjust as needed)
const MIN_HORIZONTAL_OFFSET = -50; // Minimum horizontal offset in pixels (adjust as needed)
const MAX_ZOOM_FACTOR = 0.4;
const MIN_ZOOM_FACTOR = 0;


// --- Styles as CSS objects for better readability ---
const containerStyle = {
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
};

const errorStyle = {
    color: 'red',
    textAlign: 'center'
};

const inputContainerStyle = {
    textAlign: 'center',
    marginBottom: '20px'
};

const canvasesContainerStyle = {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    flexWrap: 'wrap'
};

const canvasWrapperStyle = {
    position: 'relative',
    width: '100%',
    overflow: 'hidden'
};

const canvasStyle = {
    display: 'block',
    maxWidth: '99%',
    height: 'auto',
    border: '1px solid black'
};

const downloadButtonStyle = {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
};

const noteStyle = {
    marginTop: '20px',
    fontSize: '0.9em',
    color: 'grey',
    textAlign: 'center'
};

const controlsContainerStyle = { // Container for Zoom, Vertical and Horizontal controls
    textAlign: 'center',
    marginTop: '20px',
    marginBottom: '20px',
    display: 'flex',
    flexDirection: 'column', // Stack controls vertically
    alignItems: 'center',
};


const controlGroupStyle = { // Style for each control group
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '10px', // Space between control groups
};


const controlButtonStyle = { // Reusable style for buttons in controls
    padding: '8px 15px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: '1px solid #ccc',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    margin: '0 5px'
};

const controlRangeStyle = { // Reusable style for range inputs in controls
    margin: '0 10px',
    width: '150px'
};

const resetButtonContainerStyle = {
    marginTop: '20px',
    textAlign: 'center'
};


const PakistaniPassportPhotoEditor = () => {
    const originalCanvasRef = useRef(null);
    const croppedCanvasRef = useRef(null);
    const [originalImage, setOriginalImage] = useState(null);
    const [faceDetection, setFaceDetection] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [zoomFactor, setZoomFactor] = useState(0.2); // Initialize zoomFactor state
    const [verticalOffset, setVerticalOffset] = useState(0); // Initialize verticalOffset state
    const [horizontalOffset, setHorizontalOffset] = useState(0); // Initialize horizontalOffset state


    // Load face detection models
    useEffect(() => {
        const loadModels = async () => {
            try {
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URI),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URI),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URI),
                ]);
                setIsLoading(false);
            } catch (err) {
                console.error("Model load error:", err);
                setError("Failed to load face detection models. Please check the /models directory and console for details.");
            }
        };
        loadModels();
    }, []);

    // Handle image upload
    const handleImageUpload = async (event) => {
        setError(null);
        setFaceDetection(null);
        setOriginalImage(null);
        setVerticalOffset(0); // Reset vertical offset on new image upload
        setHorizontalOffset(0); // Reset horizontal offset on new image upload
        setZoomFactor(0.2); // Reset zoom factor on new image upload

        const file = event.target.files[0];
        if (!file) return;

        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = async () => {
            if (img.width < MIN_IMAGE_RESOLUTION || img.height < MIN_IMAGE_RESOLUTION) {
                setError(`Image resolution is too low. Please upload a higher-quality image (min ${MIN_IMAGE_RESOLUTION}x${MIN_IMAGE_RESOLUTION}).`);
                return;
            }

            setOriginalImage(img);
            const canvas = originalCanvasRef.current;
            if (!canvas) return;

            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, img.width, img.height);

            if (!faceapi.nets.tinyFaceDetector.isLoaded) {
                setError("Face detection model not loaded yet. Please wait.");
                return;
            }

            try {
                const detectionOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 });
                const detection = await faceapi.detectSingleFace(canvas, detectionOptions).withFaceLandmarks().withFaceDescriptor();

                if (!detection) {
                    setError("No face detected. Please upload another photo where the face is clearly visible and well-lit.");
                    return;
                }

                // Check if the person is looking at the camera
                const landmarks = detection.landmarks;
                const leftEye = landmarks.getLeftEye();
                const rightEye = landmarks.getRightEye();

                const eyeLineVector = {
                    x: rightEye[0].x - leftEye[0].x,
                    y: rightEye[0].y - leftEye[0].y,
                };
                const angle = Math.atan2(eyeLineVector.y, eyeLineVector.x) * 180 / Math.PI;

                if (Math.abs(angle) > EYE_ANGLE_TOLERANCE_DEGREES) {
                    setError("Please look directly at the camera.");
                    return;
                }
                setFaceDetection(detection);

            } catch (err) {
                console.error("Face detection error:", err);
                setError("An error occurred during face detection.");
            }
        };

        img.onerror = () => {
            setError("Error loading image. Please try another image file.");
        };
    };


    // Update cropped canvas
    useEffect(() => {
        if (!originalImage || !faceDetection) return;

        const croppedCanvas = croppedCanvasRef.current;
        if (!croppedCanvas) return;

        const dpi = PASSPORT_DPI;
        const passportWidthPx = Math.round((PASSPORT_WIDTH_MM / 25.4) * dpi);
        const passportHeightPx = Math.round((PASSPORT_HEIGHT_MM / 25.4) * dpi);

        croppedCanvas.width = passportWidthPx;
        croppedCanvas.height = passportHeightPx;
        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCtx.clearRect(0, 0, passportWidthPx, passportHeightPx);


        const landmarks = faceDetection.landmarks;
        const chin = landmarks.positions[8];
        const topOfHead = getTopOfHead(faceDetection, zoomFactor); // Pass zoomFactor to getTopOfHead


        const minHeadHeightPx = Math.round((HEAD_HEIGHT_MIN_MM / 25.4) * dpi);
        const maxHeadHeightPx = Math.round((HEAD_HEIGHT_MAX_MM / 25.4) * dpi);
        const targetHeadHeightPx = (minHeadHeightPx + maxHeadHeightPx) / 2;
        const actualHeadHeightPx = chin.y - topOfHead.y;
        const scale = targetHeadHeightPx / actualHeadHeightPx;
        const topMarginPx = Math.round((TOP_MARGIN_MM / 25.4) * dpi);
        const scaledTopOfHeadY = topOfHead.y * scale;
        const offsetY = topMarginPx - scaledTopOfHeadY + verticalOffset; // Add verticalOffset to offsetY
        // Incorporate horizontalOffset here:
        const faceCenterX = faceDetection.detection.box.x + faceDetection.detection.box.width / 2;
        const scaledFaceCenterX = faceCenterX * scale;
        const offsetX = (passportWidthPx / 2) - scaledFaceCenterX + horizontalOffset; // Add horizontalOffset to offsetX


        croppedCtx.drawImage(
            originalCanvasRef.current,
            0, 0, originalImage.width, originalImage.height,
            offsetX, offsetY, originalImage.width * scale, originalImage.height * scale
        );

    }, [originalImage, faceDetection, zoomFactor, verticalOffset, horizontalOffset]); // useEffect depends on horizontalOffset


    // Helper Function: Estimate Top of Head (Original Version - Adjustable Offset from Zoom)
    const getTopOfHead = (detection, currentZoomFactor) => { //Accept zoomFactor as argument
        const landmarks = detection.landmarks;
        const noseTip = landmarks.getNose()[3];
        const {  y, height } = detection.detection.box;

        // Use zoomFactor to adjust head top estimation
        const headTopY = Math.max(0, y - (height * currentZoomFactor)); // Use currentZoomFactor here
        return { x: noseTip.x, y: headTopY };
    };

    // Zoom Controls Handlers
    const handleZoomChange = (event) => {
        setZoomFactor(parseFloat(event.target.value));
    };

    const handleZoomIn = () => {
        setZoomFactor(prevZoom => Math.min(prevZoom + ZOOM_STEP, MAX_ZOOM_FACTOR)); // Example max zoomFactor 0.4
    };

    const handleZoomOut = () => {
        setZoomFactor(prevZoom => Math.max(prevZoom - ZOOM_STEP, MIN_ZOOM_FACTOR)); // Example min zoomFactor 0
    };

    // Vertical Move Controls Handlers
    const handleVerticalOffsetChange = (event) => {
        setVerticalOffset(parseInt(event.target.value, 10));
    };

    const handleMoveUp = () => {
        setVerticalOffset(prevOffset => Math.min(prevOffset + VERTICAL_STEP, MAX_VERTICAL_OFFSET));
    };

    const handleMoveDown = () => {
        setVerticalOffset(prevOffset => Math.max(prevOffset - VERTICAL_STEP, MIN_VERTICAL_OFFSET));
    };

    // Horizontal Move Controls Handlers
    const handleHorizontalOffsetChange = (event) => {
        setHorizontalOffset(parseInt(event.target.value, 10));
    };

    const handleMoveLeft = () => {
        setHorizontalOffset(prevOffset => Math.min(prevOffset + HORIZONTAL_STEP, MAX_HORIZONTAL_OFFSET));
    };

    const handleMoveRight = () => {
        setHorizontalOffset(prevOffset => Math.max(prevOffset - HORIZONTAL_STEP, MIN_HORIZONTAL_OFFSET));
    };

    // Reset All Controls Handler
    const handleReset = () => {
        setZoomFactor(0.2);
        setVerticalOffset(0);
        setHorizontalOffset(0);
    };

    // Auto-Fit Head Size Handler
    const handleAutoFitHeadSize = () => {
        if (!faceDetection || !originalImage) return;

        const landmarks = faceDetection.landmarks;
        const chin = landmarks.positions[8];
        const topOfHeadEstimate = getTopOfHead(faceDetection, zoomFactor); // Use current zoomFactor for initial estimate
        const actualHeadHeightPx = chin.y - topOfHeadEstimate.y;

        const dpi = PASSPORT_DPI;
        const minHeadHeightPx = Math.round((HEAD_HEIGHT_MIN_MM / 25.4) * dpi);
        const maxHeadHeightPx = Math.round((HEAD_HEIGHT_MAX_MM / 25.4) * dpi);
        const targetHeadHeightPx = (minHeadHeightPx + maxHeadHeightPx) / 2;


        let calculatedZoom = targetHeadHeightPx / actualHeadHeightPx;
        calculatedZoom = Math.min(Math.max(calculatedZoom, MIN_ZOOM_FACTOR), MAX_ZOOM_FACTOR); // Constrain zoom

        setZoomFactor(calculatedZoom);
        setVerticalOffset(0); // Reset vertical offset when auto-fitting zoom
        setHorizontalOffset(0); // Reset horizontal offset when auto-fitting zoom
    };


    // Download cropped passport photo
    const handleDownload = () => {
        if (!faceDetection) {
            alert("Please upload an image and wait for face detection to complete.");
            return;
        }
        const croppedCanvas = croppedCanvasRef.current;
        if (!croppedCanvas) return;

        const link = document.createElement('a');
        link.href = croppedCanvas.toDataURL('image/jpeg', 0.95);
        link.download = 'pakistani-passport-photo.jpg';
        link.click();
    };

    return (
        <div style={containerStyle}>
            <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>Pakistani Passport Photo Editor</h1>
            {error && <p style={errorStyle}>{error}</p>}
            <div style={inputContainerStyle}>
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isLoading}
                    style={{ display: 'block', margin: '0 auto' }}
                />
                {isLoading && <p>Loading face detection models...</p>}
            </div>

            <div style={controlsContainerStyle}>

                <div style={controlGroupStyle}>
                    <button style={controlButtonStyle} onClick={handleZoomOut}>Zoom Out</button>
                    <input
                        type="range"
                        min={MIN_ZOOM_FACTOR}
                        max={MAX_ZOOM_FACTOR}
                        step={ZOOM_STEP}
                        value={zoomFactor}
                        onChange={handleZoomChange}
                        style={controlRangeStyle}
                    />
                    <button style={controlButtonStyle} onClick={handleZoomIn}>Zoom In</button>
                </div>

                <div style={controlGroupStyle}>
                    <button style={controlButtonStyle} onClick={handleMoveDown}>Move Down</button>
                    <input
                        type="range"
                        min={MIN_VERTICAL_OFFSET}
                        max={MAX_VERTICAL_OFFSET}
                        step={VERTICAL_STEP}
                        value={verticalOffset}
                        onChange={handleVerticalOffsetChange}
                        style={controlRangeStyle}
                    />
                    <button style={controlButtonStyle} onClick={handleMoveUp}>Move Up</button>
                </div>

                <div style={controlGroupStyle}>
                    <button style={controlButtonStyle} onClick={handleMoveLeft}>Move Left</button>
                    <input
                        type="range"
                        min={MIN_HORIZONTAL_OFFSET}
                        max={MAX_HORIZONTAL_OFFSET}
                        step={HORIZONTAL_STEP}
                        value={horizontalOffset}
                        onChange={handleHorizontalOffsetChange}
                        style={controlRangeStyle}
                    />
                    <button style={controlButtonStyle} onClick={handleMoveRight}>Move Right</button>
                </div>

                    <div style={resetButtonContainerStyle}>
                        <button style={downloadButtonStyle} onClick={handleReset}>Reset All</button>
                    </div>

                    <div style={resetButtonContainerStyle}>
                        <button style={downloadButtonStyle} onClick={handleAutoFitHeadSize}>Auto-Fit Head Size</button>
                    </div>


            </div>


            <div style={canvasesContainerStyle}>
                <div style={{ flex: '1 1 400px', minWidth: '300px', maxWidth: '600px' }}>
                    <h3>Original Image</h3>
                    <div style={canvasWrapperStyle}>
                        <canvas ref={originalCanvasRef} style={canvasStyle} />
                    </div>
                </div>
                <div style={{ flex: '1 1 200px', minWidth: '150px', maxWidth: '300px' }}>
                    <h3>Cropped Passport Photo (35mm x 45mm, 600 DPI)</h3>
                    <div style={canvasWrapperStyle}>
                        <canvas ref={croppedCanvasRef} style={canvasStyle} />
                    </div>
                </div>
            </div>

            <div style={inputContainerStyle}>
                <button
                    onClick={handleDownload}
                    disabled={!faceDetection || isLoading}
                    style={downloadButtonStyle}
                >
                    Download Passport Photo
                </button>
            </div>
            <p style={noteStyle}>
                * Upload a high-resolution image with clear, frontal face and good lighting.  Make sure you are looking straight at the camera.
            </p>
        </div>
    );
};

export default PakistaniPassportPhotoEditor;