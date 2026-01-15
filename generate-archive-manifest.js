#!/usr/bin/env node

/**
 * Script to generate archive manifest JSON file
 * Scans the archive folder and creates a manifest.json file
 * Run this script whenever you add new videos to the archive folder
 */

const fs = require('fs');
const path = require('path');

const ARCHIVE_DIR = path.join(__dirname, 'archive');
const MANIFEST_FILE = path.join(__dirname, 'archive', 'manifest.json');

// Video file extensions
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
// Image file extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.JPG', '.JPEG', '.PNG'];

function isVideoFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
}

function isImageFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
}

function isMediaFile(filename) {
    return isVideoFile(filename) || isImageFile(filename);
}

function scanArchiveDirectory(dir) {
    const structure = {
        folders: {},
        files: []
    };
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            // Recursively scan subdirectories
            structure.folders[entry.name] = scanArchiveDirectory(fullPath);
        } else if (entry.isFile() && isMediaFile(entry.name)) {
            // This is a media file (video or image)
            const relativePath = path.relative(ARCHIVE_DIR, fullPath).replace(/\\/g, '/');
            structure.files.push({
                name: entry.name,
                path: relativePath,
                type: isVideoFile(entry.name) ? 'video' : 'image'
            });
        }
    }

    return structure;
}

try {
    console.log('Scanning archive directory...');
    
    if (!fs.existsSync(ARCHIVE_DIR)) {
        console.error(`Archive directory not found: ${ARCHIVE_DIR}`);
        process.exit(1);
    }

    const structure = scanArchiveDirectory(ARCHIVE_DIR);

    // Write manifest file
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(structure, null, 2), 'utf8');
    
    console.log(`✓ Manifest generated successfully: ${MANIFEST_FILE}`);
    console.log(`✓ Found ${Object.keys(structure.folders).length} top-level folder(s)`);
    
    // Count total media files
    let totalVideos = 0;
    let totalImages = 0;
    function countMedia(obj) {
        if (obj.files) {
            obj.files.forEach(file => {
                if (file.type === 'video') totalVideos++;
                else if (file.type === 'image') totalImages++;
            });
        }
        if (obj.folders) {
            for (const folder of Object.values(obj.folders)) {
                countMedia(folder);
            }
        }
    }
    countMedia(structure);
    console.log(`✓ Found ${totalVideos} video file(s) and ${totalImages} image file(s)`);
    
} catch (error) {
    console.error('Error generating manifest:', error);
    process.exit(1);
}

