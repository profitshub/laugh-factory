const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, 'images');

// Delete all jpg files and the mapping file
function cleanup() {
    if (fs.existsSync(IMAGES_DIR)) {
        const files = fs.readdirSync(IMAGES_DIR);
        files.forEach(file => {
            if (file.endsWith('.jpg') || file === 'downloaded-images.json') {
                const filePath = path.join(IMAGES_DIR, file);
                fs.unlinkSync(filePath);
                console.log(`Deleted: ${file}`);
            }
        });
    }
}

cleanup();