// src/App.js
import React from 'react';
import PassportPhotoEditor from './components/PassportPhotoEditor';
import './styles.css';

function App() {
    return (
        <div className="app-container">
            <h1>Pakistani Passport Photo Creator</h1>
            <p>Upload a photo to create a Pakistani passport size photo.</p>
            <PassportPhotoEditor />

            <div className="instructions">
                <h2>Instructions:</h2>
                <ol>
                    <li>Upload a clear photo of your face using the "Choose File" button.</li>
                    <li>Ensure your full face is visible and well-lit in the photo.</li>
                    <li>Wait for face detection to process the image (a red box will appear around the detected face). If no face is detected, try a different photo.</li>
                    <li>Click the "Crop & Download Passport Photo" button to generate and download the standardized passport photo.</li>
                    <li>The downloaded image will be a 35mm x 45mm JPEG file, cropped and scaled according to Pakistani passport photo standards.</li>
                </ol>
                <p><b>Note:</b> This application provides an approximation based on the provided dimensions. Always verify with official passport guidelines for precise requirements.</p>
            </div>
        </div>
    );
}

export default App;