const http = require('http');
const fs = require('fs');
const path = require('path');

const startServer = (port) => {
    const server = http.createServer((req, res) => {
        console.log('Request:', req.url);

        // Clean the URL and decode it
        const cleanUrl = decodeURIComponent(req.url.split('?')[0]);
        let filePath = path.join(__dirname, cleanUrl === '/' ? 'index.html' : cleanUrl);

        // Set content type based on extension
        const extname = path.extname(filePath).toLowerCase();
        const contentTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif'
        };

        const contentType = contentTypes[extname] || 'application/octet-stream';

        // Try to read and serve the file
        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    // For images, try fallback
                    if (contentType.startsWith('image/')) {
                        const fallbackPath = path.join(__dirname, 'assets', 'fallback.jpg');
                        fs.readFile(fallbackPath, (err, imgContent) => {
                            if (err) {
                                res.writeHead(404);
                                res.end('Image not found');
                            } else {
                                res.writeHead(200, { 'Content-Type': 'image/jpeg' });
                                res.end(imgContent);
                            }
                        });
                    } else {
                        res.writeHead(404);
                        res.end('File not found');
                    }
                } else {
                    res.writeHead(500);
                    res.end('Server error');
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.log(`Port ${port} is busy, trying ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', error);
        }
    });

    server.listen(port, () => {
        console.clear(); // Clear previous attempts
        console.log(`Server running at http://localhost:${port}/`);
        console.log(`Serving files from: ${__dirname}`);
        console.log('Press Ctrl+C to stop the server');
    });
};

// Start with initial port
startServer(8000);
