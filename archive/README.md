# Archive System

This archive system organizes family videos by family name and video collection folders.

## Structure

```
archive/
  ├── manifest.json (auto-generated)
  ├── FamilyName1/
  │   ├── Video Collection 1/
  │   │   ├── video1.mp4
  │   │   └── video2.mp4
  │   └── Video Collection 2/
  │       └── video1.mp4
  └── FamilyName2/
      └── ...
```

## Adding New Videos/Images

### Automatic (Recommended - if using GitHub)

If your site is hosted on GitHub Pages, the manifest will be **automatically generated** when you push changes to the `archive/` folder. No manual steps needed!

### Manual Generation

If you need to generate the manifest manually (e.g., for local testing):

1. Add your video/image files to the appropriate family folder and collection folder
2. Run the manifest generator:
   ```bash
   node generate-archive-manifest.js
   ```
3. The `manifest.json` file will be automatically updated

## Supported Media Formats

### Videos
- .mp4
- .avi
- .mov
- .wmv
- .flv
- .webm
- .mkv
- .m4v

### Images
- .jpg / .jpeg
- .png
- .gif
- .bmp
- .webp
- .tiff / .tif

## Notes

- The manifest.json file is automatically generated and should not be edited manually
- Video files should be placed in folders named after the video collection
- Family names are used as top-level organization folders

