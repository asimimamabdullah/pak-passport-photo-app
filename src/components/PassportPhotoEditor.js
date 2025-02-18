import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';

const PassportPhotoEditor = () => {
    const originalCanvasRef = useRef(null);
    const croppedCanvasRef = useRef(null);
    const [originalImage, setOriginalImage] = useState(null);
    const [faceDetection, setFaceDetection] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [cropRegion, setCropRegion] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [resizeHandle, setResizeHandle] = useState(null);
    const [aspectRatio, setAspectRatio] = useState(3 / 4); // Default 3:4
    const [zoomLevel, setZoomLevel] = useState(1);
    const [rotationAngle, setRotationAngle] = useState(0);
    const [headSizeGuide, setHeadSizeGuide] = useState({ min: 0.4, max: 0.5 }); // Example head size guide
    const [showGuides, setShowGuides] = useState(true);
    const [selectedAspectRatioPreset, setSelectedAspectRatioPreset] = useState('3:4');
    const aspectRatioPresets = {
        '3:4': 3 / 4,
        '4:5': 4 / 5,
        '1:1': 1,
        'custom': null, // Will use customAspectRatio state
    };
    const [customAspectRatio, setCustomAspectRatio] = useState('');
    const [isAspectRatioCustom, setIsAspectRatioCustom] = useState(false);


    // Load face detection models
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
                alert("Failed to load face detection models. Please check the /models directory and console for details.");
            }
        };
        loadModels();
    }, []);

    // Handle image upload
    const handleImageUpload = async (event) => {
        setFaceDetection(null);
        setOriginalImage(null);
        setCropRegion({ x: 0, y: 0, width: 0, height: 0 }); // Reset crop region
        setZoomLevel(1); // Reset zoom
        setRotationAngle(0); // Reset rotation

        const file = event.target.files[0];
        if (!file) return;

        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = async () => {
            if (img.width < 600 || img.height < 600) {
                alert("Image resolution is too low. Please upload a higher-quality image (min 600x600).");
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
                alert("Face detection model not loaded yet. Please wait.");
                return;
            }

            const detectionOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.3 });
            const detection = await faceapi.detectSingleFace(canvas, detectionOptions).withFaceLandmarks();

            if (detection) {
                const faceBox = detection.detection.box;
                const landmarks = detection.landmarks.positions;
                const eyeLeft = landmarks[36];
                const eyeRight = landmarks[45];
                const eyeMidpointX = (eyeLeft.x + eyeRight.x) / 2;
                const eyeMidpointY = (eyeLeft.y + eyeRight.y) / 2;

                const cropWidth = Math.min(faceBox.width * 1.8, img.width); // Slightly wider initial crop
                const currentAspectRatio = isAspectRatioCustom && customAspectRatio ? parseFloat(customAspectRatio) : aspectRatioPresets[selectedAspectRatioPreset];
                const cropHeight = currentAspectRatio ? cropWidth / currentAspectRatio : cropWidth / aspectRatio;


                setCropRegion({
                    x: Math.max(0, eyeMidpointX - cropWidth / 2), // Center X around eye midpoint
                    y: Math.max(0, eyeMidpointY - cropHeight / 2 - faceBox.height * 0.2), // Center Y slightly above eye midpoint
                    width: cropWidth,
                    height: cropHeight,
                });
                setFaceDetection(detection);

            } else {
                alert("No face detected. Please upload another photo where the face is clearly visible and well-lit.");
            }
        };

        img.onerror = () => {
            alert("Error loading image. Please try another image file.");
        };
    };

    // Update cropped canvas whenever cropRegion, originalImage, faceDetection, etc. changes
    useEffect(() => {
        const updateCroppedCanvas = () => {
            if (!originalImage || !faceDetection) return;

            const croppedCanvas = croppedCanvasRef.current;
            if (!croppedCanvas) return;

            const dpi = 300;
            const passportWidthPx = Math.round((35 / 25.4) * dpi);
            const passportHeightPx = Math.round((45 / 25.4) * dpi);

            croppedCanvas.width = passportWidthPx;
            croppedCanvas.height = passportHeightPx;
            const croppedCtx = croppedCanvas.getContext('2d');
            croppedCtx.clearRect(0, 0, passportWidthPx, passportHeightPx); // Clear canvas before drawing

            croppedCtx.save(); // Save context to apply zoom and rotation
            croppedCtx.translate(passportWidthPx / 2, passportHeightPx / 2); // Translate to center for rotation/zoom
            croppedCtx.rotate(rotationAngle * Math.PI / 180);
            croppedCtx.scale(zoomLevel, zoomLevel);
            croppedCtx.translate(-passportWidthPx / 2, -passportHeightPx / 2); // Translate back

            croppedCtx.drawImage(
                originalCanvasRef.current,
                cropRegion.x, cropRegion.y, cropRegion.width, cropRegion.height,
                0, 0, passportWidthPx, passportHeightPx
            );
            croppedCtx.restore(); // Restore context to remove zoom and rotation

            if (showGuides) {
                drawGuides(croppedCtx, passportWidthPx, passportHeightPx);
            }

        };
        updateCroppedCanvas();
    }, [originalImage, faceDetection, cropRegion, zoomLevel, rotationAngle, showGuides]);

    const drawGuides = (ctx, canvasWidth, canvasHeight) => {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;

        // Head size guide (example - adjust values as needed based on guidelines)
        const minHeadHeight = canvasHeight * headSizeGuide.min;
        const maxHeadHeight = canvasHeight * headSizeGuide.max;
        ctx.beginPath();
        ctx.moveTo(0, canvasHeight - maxHeadHeight);
        ctx.lineTo(canvasWidth, canvasHeight - maxHeadHeight);
        ctx.moveTo(0, canvasHeight - minHeadHeight);
        ctx.lineTo(canvasWidth, canvasHeight - minHeadHeight);
        ctx.stroke();

         // Eye line guide (example - adjust vertical position as needed)
        const eyeLineY = canvasHeight * 0.35; // Example: Eyes at 35% from top
        ctx.beginPath();
        ctx.strokeStyle = 'green';
        ctx.moveTo(0, eyeLineY);
        ctx.lineTo(canvasWidth, eyeLineY);
        ctx.stroke();
    };


    // Drag and resize logic - improved with aspect ratio constraint
    const handleMouseDown = (e) => {
        if (!faceDetection) return; // Prevent dragging/resizing if no face detected

        const rect = originalCanvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const { x, y, width, height } = cropRegion;

        const resizeHandleSize = 20; // Increased resize handle size for easier interaction

        if (
            mouseX > x + width - resizeHandleSize &&
            mouseX < x + width + resizeHandleSize &&
            mouseY > y + height - resizeHandleSize &&
            mouseY < y + height + resizeHandleSize
        ) {
            setResizeHandle('bottom-right');
        } else if (mouseX > x && mouseX < x + width && mouseY > y && mouseY < y + height) {
            setIsDragging(true);
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging && !resizeHandle || !originalImage) return;

        const rect = originalCanvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const { x, y, width, height } = cropRegion;
        const currentAspectRatio = isAspectRatioCustom && customAspectRatio ? parseFloat(customAspectRatio) : aspectRatioPresets[selectedAspectRatioPreset];


        if (isDragging) {
            setCropRegion({
                x: Math.max(0, Math.min(mouseX - width / 2, originalImage.width - width)),
                y: Math.max(0, Math.min(mouseY - height / 2, originalImage.height - height)),
                width,
                height,
            });
        } else if (resizeHandle === 'bottom-right') {
            let newWidth = Math.max(50, mouseX - x);
            let newHeight = currentAspectRatio ? newWidth / currentAspectRatio : newWidth / aspectRatio;

             // Keep crop region within image bounds during resize
            if (x + newWidth > originalImage.width) {
                newWidth = originalImage.width - x;
                if (currentAspectRatio) newHeight = newWidth / currentAspectRatio; else newHeight = newWidth / aspectRatio;
            }
            if (y + newHeight > originalImage.height) {
                 newHeight = originalImage.height - y;
                 if (currentAspectRatio) newWidth = currentAspectRatio ? newHeight * currentAspectRatio: newHeight * aspectRatio; else newWidth = newHeight * aspectRatio;
                 if (x + newWidth > originalImage.width) newWidth = originalImage.width - x; //Re-adjust width if height limit caused width overflow again
            }


            setCropRegion({
                x,
                y,
                width: newWidth,
                height: newHeight,
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setResizeHandle(null);
    };


    const handleZoomChange = (e) => {
        setZoomLevel(parseFloat(e.target.value));
    };

    const handleRotationChange = (e) => {
        setRotationAngle(parseFloat(e.target.value));
    };
    const handleToggleGuides = () => {
        setShowGuides(!showGuides);
    };

    const handleAspectRatioPresetChange = (e) => {
        setSelectedAspectRatioPreset(e.target.value);
        setIsAspectRatioCustom(e.target.value === 'custom');
        if (e.target.value !== 'custom') {
            setAspectRatio(aspectRatioPresets[e.target.value]);
        }
    };

    const handleCustomAspectRatioChange = (e) => {
        setCustomAspectRatio(e.target.value);
        if (isAspectRatioCustom && e.target.value) {
            setAspectRatio(parseFloat(e.target.value));
        } else if (!isAspectRatioCustom) {
            setAspectRatio(aspectRatioPresets[selectedAspectRatioPreset]); //Revert to preset if custom is unchecked
        }
    };
    const handleCustomAspectRatioCheckboxChange = (e) => {
        setIsAspectRatioCustom(e.target.checked);
        if (e.target.checked && customAspectRatio) {
             setAspectRatio(parseFloat(customAspectRatio));
        } else if (!e.target.checked) {
            setAspectRatio(aspectRatioPresets[selectedAspectRatioPreset]); //Revert to preset
        }
    };


    // Download cropped passport photo
    const handleDownload = (format = 'jpeg') => {
        if (!faceDetection || isLoading) {
            alert("Please upload an image and wait for face detection to complete.");
            return;
        }
        const croppedCanvas = croppedCanvasRef.current;
        if (!croppedCanvas) return;

        const link = document.createElement('a');
        link.href = croppedCanvas.toDataURL(`image/${format}`, format === 'jpeg' ? 0.9 : 1); // JPEG quality 0.9
        link.download = `passport-photo.${format}`;
        link.click();
    };

    return (
        <div>
            <h1>Passport Photo Editor</h1>
            <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isLoading}
                style={{ display: 'block', margin: '20px auto' }}
            />
            {isLoading && <p>Loading face detection models...</p>}

            <div style={{ margin: '20px auto', textAlign: 'center' }}>
                <label htmlFor="aspectRatioPreset">Aspect Ratio Preset:</label>
                <select id="aspectRatioPreset" value={selectedAspectRatioPreset} onChange={handleAspectRatioPresetChange} style={{ margin: '0 10px' }}>
                    {Object.keys(aspectRatioPresets).filter(key => key !== 'custom').map(key => (
                        <option key={key} value={key}>{key}</option>
                    ))}
                     <option value="custom">Custom</option>
                </select>

                {selectedAspectRatioPreset === 'custom' && (
                    <>
                         <label htmlFor="customAspectRatio" style={{ margin: '0 10px' }}>Custom Ratio:</label>
                        <input
                            type="number"
                            id="customAspectRatio"
                            value={customAspectRatio}
                            onChange={handleCustomAspectRatioChange}
                            placeholder="e.g., 0.75 (for 3:4)"
                            step="0.01"
                            style={{ width: '80px', margin: '0 10px' }}
                            disabled={!isAspectRatioCustom}

                        />
                        <label>
                           <input
                                type="checkbox"
                                checked={isAspectRatioCustom}
                                onChange={handleCustomAspectRatioCheckboxChange}
                                style={{ margin: '0 5px' }}
                            />
                            Use Custom Ratio
                        </label>
                    </>
                )}


                <label htmlFor="zoomLevel" style={{ margin: '0 10px' }}>Zoom:</label>
                <input
                    type="range"
                    id="zoomLevel"
                    min="0.5"
                    max="2"
                    step="0.05"
                    value={zoomLevel}
                    onChange={handleZoomChange}
                    style={{ width: '100px', margin: '0 10px' }}
                />
                <span style={{ margin: '0 10px' }}>{zoomLevel.toFixed(2)}x</span>

                <label htmlFor="rotationAngle" style={{ margin: '0 10px' }}>Rotation:</label>
                <input
                    type="range"
                    id="rotationAngle"
                    min="-10"
                    max="10"
                    step="1"
                    value={rotationAngle}
                    onChange={handleRotationChange}
                    style={{ width: '100px', margin: '0 10px' }}
                />
                <span>{rotationAngle}°</span>
                <button onClick={handleToggleGuides} style={{ margin: '0 10px' }}>
                    {showGuides ? 'Hide Guides' : 'Show Guides'}
                </button>

            </div>


            <div className="preview-container">
                <div className="preview-box">
                    <h3>Original Image</h3>
                    <div
                        className="image-container"
                        style={{ position: 'relative' }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <canvas ref={originalCanvasRef} style={{ maxWidth: '100%', height: 'auto' }} />
                        {faceDetection && (
                            <div
                                className="crop-box"
                                style={{
                                    position: 'absolute',
                                    left: `${cropRegion.x}px`,
                                    top: `${cropRegion.y}px`,
                                    width: `${cropRegion.width}px`,
                                    height: `${cropRegion.height}px`,
                                    border: '2px solid blue',
                                    boxSizing: 'border-box',
                                    pointerEvents: 'none',
                                }}
                            >
                                {/* Resize handle */}
                                <div
                                    style={{
                                        position: 'absolute',
                                        right: '-10px',
                                        bottom: '-10px',
                                        width: '20px',
                                        height: '20px',
                                        backgroundColor: 'blue',
                                        cursor: 'nwse-resize',
                                    }}
                                ></div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="preview-box">
                    <h3>Cropped Passport Photo (35mm x 45mm)</h3>
                    <canvas ref={croppedCanvasRef} style={{ border: '1px solid black', maxWidth: '100%' }} />
                </div>
            </div>
            <div className="button-group">
                <button onClick={() => handleDownload('jpeg')} disabled={!faceDetection || isLoading}>
                    Crop & Download JPEG
                </button>
                <button onClick={() => handleDownload('png')} disabled={!faceDetection || isLoading}>
                    Crop & Download PNG
                </button>
            </div>
             <p style={{marginTop: '20px', fontSize: '0.9em', color: 'grey'}}>
                * Adjust the crop box on the "Original Image" to fine-tune your passport photo. <br/>
                * Use the zoom and rotation controls above for further adjustments. <br/>
                * 'Show Guides' toggles visual aids on the Cropped Passport Photo to help with alignment and sizing based on common guidelines. <br/>
                * For best results, upload a high-resolution image with clear, frontal face and good lighting.
            </p>
        </div>
    );
};

export default PassportPhotoEditor;