// Archive Page JavaScript

// Password protection with hashed password (SHA-256 hash of the actual password)
// To change password: hash your new password using SHA-256 and update PASSWORD_HASH below
// You can generate hash at: https://emn178.github.io/online-tools/sha256.html
// Default password hash (change this to your desired password hash)
const PASSWORD_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'; // hash of 'admin'

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Load archive data from HTML
    loadArchiveData();
    
    // Check if already authenticated (session only, clears on refresh)
    if (!sessionStorage.getItem('archive_auth')) {
        showPasswordPrompt();
    } else {
        showArchiveContent();
    }
});

// Load archive data from HTML
function loadArchiveData() {
    const archiveDataContainer = document.getElementById('archive-data');
    if (!archiveDataContainer) {
        archiveData = { folders: [] };
        return;
    }
    
    const folders = [];
    const folderElements = archiveDataContainer.querySelectorAll('.archive-folder');
    
    folderElements.forEach(folderEl => {
        const folderName = folderEl.dataset.folderName || 'Unnamed Folder';
        const items = [];
        
        const itemElements = folderEl.querySelectorAll('.archive-item');
        itemElements.forEach(itemEl => {
            items.push({
                name: itemEl.dataset.name || 'Unnamed Item',
                url: itemEl.dataset.url || '',
                type: itemEl.dataset.type || 'video'
            });
        });
        
        folders.push({
            name: folderName,
            items: items
        });
    });
    
    archiveData = { folders: folders };
}

// Hash function (SHA-256)
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Show password prompt
function showPasswordPrompt() {
    const overlay = document.getElementById('password-overlay');
    const content = document.getElementById('archive-content');
    
    if (overlay) overlay.style.display = 'flex';
    if (content) content.style.display = 'none';
    
    const passwordForm = document.getElementById('password-form');
    const passwordInput = document.getElementById('password-input');
    
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordSubmit);
    }
    
    if (passwordInput) {
        passwordInput.focus();
    }
}

// Handle password form submission
async function handlePasswordSubmit(e) {
    e.preventDefault();
    
    const passwordInput = document.getElementById('password-input');
    const errorDiv = document.getElementById('password-error');
    const password = passwordInput.value.trim();
    
    if (errorDiv) {
        errorDiv.textContent = '';
    }
    
    // Hash the entered password and compare
    const enteredHash = await sha256(password);
    
    if (enteredHash === PASSWORD_HASH) {
        sessionStorage.setItem('archive_auth', 'true');
        showArchiveContent();
    } else {
        if (errorDiv) {
            errorDiv.textContent = 'Incorrect password. Please try again.';
        }
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
        }
        
        // Shake animation
        const modal = document.querySelector('.password-modal');
        if (modal) {
            modal.style.animation = 'shake 0.5s';
            setTimeout(() => {
                modal.style.animation = '';
            }, 500);
        }
    }
}

// Show archive content
function showArchiveContent() {
    const overlay = document.getElementById('password-overlay');
    const content = document.getElementById('archive-content');
    
    if (overlay) {
        overlay.classList.add('hidden');
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    }
    
    if (content) {
        content.style.display = 'block';
        renderArchive();
    }
}

// Render archive content
function renderArchive() {
    const container = document.getElementById('archive-container');
    if (!container || !archiveData) return;
    
    container.innerHTML = '';
    
    if (!archiveData.folders || archiveData.folders.length === 0) {
        container.innerHTML = '<div class="bubble"><h3>No Content</h3><p class="project-description">No archive items found.</p></div>';
        return;
    }
    
    archiveData.folders.forEach(folder => {
        const folderBubble = createFolderBubble(folder);
        container.appendChild(folderBubble);
    });
}

// Create folder bubble
function createFolderBubble(folder) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble archive-folder-bubble';
    
    const header = document.createElement('h3');
    header.className = 'project-title';
    header.textContent = folder.name;
    bubble.appendChild(header);
    
    // Items container
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'archive-items-container';
    
    if (folder.items && folder.items.length > 0) {
        folder.items.forEach(item => {
            const itemElement = createArchiveItem(item);
            itemsContainer.appendChild(itemElement);
        });
    }
    
    bubble.appendChild(itemsContainer);
    return bubble;
}

// Create archive item (video/image link)
function createArchiveItem(item) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'archive-item';
    
    const isYouTube = item.url && (item.url.includes('youtube.com') || item.url.includes('youtu.be'));
    const youtubeId = isYouTube ? extractYouTubeId(item.url) : null;
    
    // Thumbnail
    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'archive-item-thumbnail';
    
    if (isYouTube && youtubeId) {
        // YouTube thumbnail
        thumbnailContainer.style.backgroundImage = `url(https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg)`;
        thumbnailContainer.style.backgroundSize = 'cover';
        thumbnailContainer.style.backgroundPosition = 'center';
        
        const playButton = document.createElement('div');
        playButton.className = 'youtube-play-button';
        playButton.innerHTML = '▶';
        thumbnailContainer.appendChild(playButton);
        
        const youtubeLabel = document.createElement('div');
        youtubeLabel.className = 'youtube-label';
        youtubeLabel.textContent = 'YouTube';
        thumbnailContainer.appendChild(youtubeLabel);
    } else if (item.type === 'image' && item.url) {
        // Image thumbnail
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = item.name;
        img.className = 'archive-thumbnail';
        img.loading = 'lazy';
        thumbnailContainer.appendChild(img);
    } else {
        // Video placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'archive-video-placeholder';
        placeholder.innerHTML = '<div class="play-icon">▶</div><p>Video</p>';
        thumbnailContainer.appendChild(placeholder);
    }
    
    itemDiv.appendChild(thumbnailContainer);
    
    // Item name
    const nameDiv = document.createElement('div');
    nameDiv.className = 'archive-item-name';
    nameDiv.textContent = item.name;
    itemDiv.appendChild(nameDiv);
    
    // Click handler
    itemDiv.style.cursor = 'pointer';
    itemDiv.addEventListener('click', () => {
        if (item.url) {
            window.open(item.url, '_blank');
        }
    });
    
    return itemDiv;
}

// Extract YouTube video ID from URL
function extractYouTubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Override showSection to prevent navigation issues
function showSection(sectionName) {
    return false;
}

