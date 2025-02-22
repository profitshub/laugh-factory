const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SHEET_ID = '1NLdlq3EHtdXhZe_AbU9eKx0-cGHk9bI7WbOJMFz0-po';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=1`;
const IMAGES_DIR = path.join(__dirname, 'images');
const MAPPING_FILE = path.join(IMAGES_DIR, 'downloaded-images.json');

async function getCurrentMapping() {
    if (fs.existsSync(MAPPING_FILE)) {
        return JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    }
    return {};
}

async function getSheetData() {
    console.log('Fetching sheet data...');
    const response = await axios.get(SHEET_URL);
    const rows = response.data.split('\n').slice(1);
    
    const newMappings = {};
    rows.forEach((row, index) => {
        const [joke, imageDescription, imageUrl] = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const fileIdMatch = imageUrl?.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const cleanImageId = fileIdMatch ? fileIdMatch[1].trim() : '';
        
        if (cleanImageId) {
            newMappings[cleanImageId] = `joke_${index + 1}.jpg`;
        }
    });
    return newMappings;
}

async function syncImages() {
    try {
        // Get current and new mappings
        const currentMapping = await getCurrentMapping();
        const newMapping = await getSheetData();

        // Find images to download and remove
        const toDownload = Object.entries(newMapping).filter(([id]) => !currentMapping[id]);
        const toRemove = Object.entries(currentMapping).filter(([id]) => !newMapping[id]);

        // Remove old images
        for (const [id, fileName] of toRemove) {
            const filePath = path.join(IMAGES_DIR, fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Removed old image: ${fileName}`);
            }
        }

        // Download new images
        for (const [fileId, fileName] of toDownload) {
            try {
                await downloadImage(fileId, fileName);
                console.log(`Downloaded new image: ${fileName}`);
                // Add delay between downloads
                await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (error) {
                console.error(`Failed to download ${fileName}:`, error.message);
            }
        }

        // Update mapping file
        fs.writeFileSync(MAPPING_FILE, JSON.stringify(newMapping, null, 2));
        console.log('Image sync completed!');
        console.log(`Added: ${toDownload.length} images`);
        console.log(`Removed: ${toRemove.length} images`);
        console.log(`Total images: ${Object.keys(newMapping).length}`);

    } catch (error) {
        console.error('Sync failed:', error);
    }
}

// Run the sync
syncImages();