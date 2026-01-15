# Archive Page Setup

## How to Add Videos/Images

Simply edit `archive.html` and add your folders and items in the `#archive-data` section:

```html
<div class="archive-folder" data-folder-name="Folder Name">
    <div class="archive-item" 
         data-name="Video Name" 
         data-url="https://www.youtube.com/watch?v=VIDEO_ID" 
         data-type="video">
    </div>
</div>
```

### Attributes:
- `data-folder-name`: The name of the folder/collection
- `data-name`: Display name for the video/image
- `data-url`: YouTube URL or image URL
- `data-type`: Either "video" or "image"

### Examples:

**YouTube Video:**
```html
<div class="archive-item" 
     data-name="Beach Vacation 2010 - Part 1" 
     data-url="https://www.youtube.com/watch?v=GyljYbQiGj8" 
     data-type="video">
</div>
```

**Image:**
```html
<div class="archive-item" 
     data-name="Family Photo" 
     data-url="https://example.com/photo.jpg" 
     data-type="image">
</div>
```

## Changing the Password

1. Go to https://emn178.github.io/online-tools/sha256.html
2. Enter your desired password
3. Copy the SHA-256 hash
4. Open `archive.js`
5. Replace the `PASSWORD_HASH` value with your new hash

**Example:**
```javascript
const PASSWORD_HASH = 'your_new_hash_here';
```

## Files Structure

- `archive.html` - Main HTML file (edit this to add links)
- `archive.js` - JavaScript functionality (edit to change password)
- `archive.css` - Styles

No JSON files or manifest needed - just edit the HTML directly!

