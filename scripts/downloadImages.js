const fs = require('fs');
const https = require('https');
const path = require('path');
const csv = require('csv-parse');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));  // Fix fetch import

const SHEET_ID = '1NLdlq3EHtdXhZe_AbU9eKx0-cGHk9bI7WbOJMFz0-po';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=1`;
// Fix path for Windows
const IMAGE_DIR = path.join(__dirname, '..', 'images');

// Add tracking for downloaded images
const TRACKING_FILE = path.join(IMAGE_DIR, 'downloaded-images.json');

// Ensure images directory exists
if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

// Load existing image tracking data
function loadImageTracker() {
    try {
        if (fs.existsSync(TRACKING_FILE)) {
            return JSON.parse(fs.readFileSync(TRACKING_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading tracking file:', error);
    }
    return {};
}

// Save image tracking data
function saveImageTracker(tracker) {
    try {
        fs.writeFileSync(TRACKING_FILE, JSON.stringify(tracker, null, 2));
    } catch (error) {
        console.error('Error saving tracking file:', error);
    }
}

async function downloadImage(url, filename, fileId) {
    const tracker = loadImageTracker();
    const filePath = path.join(IMAGE_DIR, filename);

    // Check if file exists and hasn't changed
    if (fs.existsSync(filePath) && tracker[fileId] === filename) {
        console.log(`Skipping existing image: ${filename}`);
        return filename;
    }

    try {
        // First, get the redirect URL
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            redirect: 'follow'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Create write stream
        const fileStream = fs.createWriteStream(filePath);
        
        return new Promise((resolve, reject) => {
            response.body.pipe(fileStream);
            
            fileStream.on('finish', () => {
                fileStream.close();
                // Update tracker
                tracker[fileId] = filename;
                saveImageTracker(tracker);
                console.log(`Successfully downloaded: ${filename}`);
                resolve(filename);
            });

            fileStream.on('error', (err) => {
                fs.unlink(filePath, () => {}); // Delete failed file
                reject(err);
            });
        });
    } catch (error) {
        throw new Error(`Download failed: ${error.message}`);
    }
}

async function processSheet() {
    try {
        const response = await fetch(SHEET_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvData = await response.text();
        
        // Debug CSV data
        console.log('CSV first line:', csvData.split('\n')[0]);
        
        const records = await new Promise((resolve, reject) => {
            csv.parse(csvData, {
                columns: true,
                skip_empty_lines: true,
                trim: true
            }, (err, records) => {
                if (err) reject(err);
                else resolve(records);
            });
        });

        console.log('First record:', records[0]); // Debug first record
        console.log(`Found ${records.length} jokes to process`);
        let downloadCount = 0;

        for (let [index, record] of records.entries()) {
            const imageUrl = record['Image URL'];
            if (!imageUrl) {
                console.log(`No image URL found in record:`, record);
                continue;
            }

            // Update the URL parsing to handle view links
            let fileId = '';
            if (imageUrl.includes('/file/d/')) {
                fileId = imageUrl.split('/file/d/')[1].split('/')[0];
            } else if (imageUrl.includes('id=')) {
                fileId = imageUrl.split('id=')[1].split('&')[0];
            }

            if (!fileId) {
                console.log(`No file ID found in URL: ${imageUrl}`);
                continue;
            }

            const filename = `joke_${index + 1}.jpg`;
            // Use the export URL format
            const gdriveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

            try {
                await downloadImage(gdriveUrl, filename, fileId);
                downloadCount++;
            } catch (error) {
                console.error(`Failed to download image ${index + 1}:`, error.message);
            }
        }

        console.log(`Downloaded ${downloadCount} new images`);
    } catch (error) {
        console.error('Error processing sheet:', error);
    }
}

processSheet();
