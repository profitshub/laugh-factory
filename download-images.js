const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SHEET_ID = '1NLdlq3EHtdXhZe_AbU9eKx0-cGHk9bI7WbOJMFz0-po';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=1`;
const IMAGES_DIR = path.join(__dirname, 'images');

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Update the getImageMappings function to properly handle the sheet data
async function getImageMappings() {
    try {
        console.log('Fetching sheet data...');
        const response = await axios.get(SHEET_URL);
        const rows = response.data.split('\n').slice(1); // Skip header row
        
        const mappings = {};
        let validImageCount = 0;

        rows.forEach((row, index) => {
            // Parse CSV properly, handling quoted fields
            const [joke, imageDescription, imageUrl] = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            
            // Extract file ID from Google Drive URL
            const fileIdMatch = imageUrl?.match(/\/d\/([a-zA-Z0-9_-]+)/);
            const cleanImageId = fileIdMatch ? fileIdMatch[1].trim() : '';
            
            if (cleanImageId) {
                validImageCount++;
                mappings[cleanImageId] = `joke_${validImageCount}.jpg`;
                console.log(`Mapped ID: ${cleanImageId} to ${mappings[cleanImageId]}`);
            }
        });

        console.log(`Found ${validImageCount} valid images in the sheet`);

        // Save the mappings to downloaded-images.json
        fs.writeFileSync(
            path.join(IMAGES_DIR, 'downloaded-images.json'),
            JSON.stringify(mappings, null, 2)
        );

        return mappings;
    } catch (error) {
        console.error('Error fetching sheet data:', error);
        throw error;
    }
}

// Update the getImageForJoke function
function getImageForJoke(jokeIndex) {
    const totalUniqueImages = 50; // Update to reflect actual number of images
    const cycledIndex = ((jokeIndex - 1) % totalUniqueImages) + 1;
    return `joke_${cycledIndex}.jpg`;
}

// Update the downloadImage function to properly handle Google Drive URLs
async function downloadImage(fileId, fileName) {
    const filePath = path.join(IMAGES_DIR, fileName);
    const url = `https://drive.google.com/uc?export=view&id=${fileId}`;

    try {
        console.log(`Downloading ${fileName} from ${url}...`);
        
        // First request to get confirmation token if needed
        const initialResponse = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            maxRedirects: 5
        });

        let downloadUrl = url;
        let cookies = initialResponse.headers['set-cookie'];

        // Check if we need confirmation token
        if (typeof initialResponse.data === 'string' && initialResponse.data.includes('confirm=')) {
            const match = initialResponse.data.match(/confirm=([0-9A-Za-z]+)/);
            if (match) {
                const confirmToken = match[1];
                downloadUrl = `${url}&confirm=${confirmToken}`;
            }
        }

        // Download file with confirmation token if needed
        const response = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Cookie': cookies ? cookies.join('; ') : '',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            maxRedirects: 5,
            validateStatus: status => status < 400
        });

        // Create write stream
        const writer = fs.createWriteStream(filePath);
        
        // Pipe the response to the file
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                const size = fs.statSync(filePath).size;
                if (size === 0) {
                    fs.unlinkSync(filePath);
                    reject(new Error(`Zero byte file: ${fileName}`));
                } else {
                    console.log(`✅ Downloaded ${fileName} (${size} bytes)`);
                    resolve();
                }
            });
            writer.on('error', err => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                reject(err);
            });
        });
    } catch (error) {
        console.error(`Failed to download ${fileName}:`, error.message);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        throw error;
    }
}

// Update the delay in downloadAllImages function
async function downloadAllImages() {
    try {
        const imageMap = await getImageMappings();
        const totalImages = Object.keys(imageMap).length;
        console.log(`Starting download of ${totalImages} images...`);
        
        let downloadedCount = 0;
        for (const [fileId, fileName] of Object.entries(imageMap)) {
            try {
                await downloadImage(fileId, fileName);
                downloadedCount++;
                console.log(`Progress: ${downloadedCount}/${totalImages}`);
                // Increased delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (error) {
                console.error(`❌ Error downloading ${fileName}:`, error.message);
            }
        }
        console.log('🎉 Download process completed!');
    } catch (error) {
        console.error('Failed to process images:', error);
    }
}

// Update the fetchJokes function
async function fetchJokes() {
    try {
        const response = await fetch(SHEET_URL);
        const csvData = await response.text();
        const rows = csvData.split('\n').slice(1);
        
        jokes = rows.map((row, index) => {
            const [joke] = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            return {
                text: joke.replace(/^"|"$/g, '').trim(),
                image: getImageForJoke(index + 1)
            };
        }).filter(joke => joke.text);

        if (jokes.length === 0) {
            throw new Error('No valid jokes found');
        }

        shuffleArray(jokes);
        await downloadAndCacheImages();
        showRandomJoke();
    } catch (error) {
        console.error('Error loading jokes:', error);
        jokeText.textContent = "Oops! The jokes are taking a coffee break! ☕";
        jokeCard.style.opacity = '1';
    }
}

// Start the download process
downloadAllImages().catch(console.error);