# experiment.red - Technical Documentation

## Project Overview

experiment.red is a command-line tool for downloading high-quality audio from YouTube videos and creating multi-track albums in M4A format with gapless playback support. The tool segments videos into tracks (based on chapters or time intervals) and embeds full metadata and artwork. Primarily designed for DJ sets and podcasts from YouTube to be played in Apple Music on macOS/iOS/iPadOS.

## Architecture

### Technology Stack

- **Runtime**: Node.js 18+ or Bun
- **Language**: JavaScript (ES Modules)
- **Core Dependencies**:
  - `yt-dlp`: YouTube video/audio download CLI
  - `ffmpeg`: Audio/video processing and metadata embedding
  - `sharp`: High-performance image processing (center-cropping)
  - `dotenv`: Environment variable management

### System Requirements

- macOS (primary target platform)
- Node.js 18+ or Bun runtime
- yt-dlp (install via `brew install yt-dlp`)
- ffmpeg with libfdk-aac support (install via `brew install ffmpeg`)

## Implementation Details

### Workflow Pipeline

The download and processing pipeline consists of the following stages:

```
1. Fetch Video Metadata
   ↓
2. Determine Segmentation Strategy
   - Use chapters if available
   - Otherwise create 5-minute segments
   ↓
3. Download Audio (M4A preferred)
   ↓
4. Download Thumbnail/Poster
   ↓
5. Process Artwork (center crop to square)
   ↓
6. [If chapters exist] Download Video for Frame Extraction
   ↓
7. [If chapters exist] Extract Frame at Each Chapter Boundary
   ↓
8. Create Album Directory
   ↓
9. For Each Segment:
   - Split audio using ffmpeg (-ss/-to with -c:a copy)
   - Embed metadata (title, artist, album, track number)
   - Embed artwork as attached_pic
   - Add gapless playback tags
   ↓
10. Save All Tracks to Album Directory
   ↓
11. Cleanup Temporary Files
```

### Audio Format Selection

**Target Format**: M4A (MPEG-4 Audio)
- Container: MPEG-4 Part 14
- Codec: AAC (Advanced Audio Coding)
- Quality: Best available (typically 128-256 kbps AAC from YouTube)

**Why M4A?**
- Native format for Apple Music/iTunes ecosystem
- Superior chapter support via QuickTime atoms
- Better quality-to-size ratio than MP3
- No transcoding needed from YouTube's native AAC streams
- Full metadata support (ID3 equivalent via MP4 atoms)

### Chapter Support

#### Chapter Format: QuickTime Chapters

M4A files support chapters through QuickTime chapter atoms in the MP4 container. These are stored in the `moov.udta` atom structure.

**Implementation**:
- Chapters are embedded using ffmpeg's FFMETADATA1 format
- Each chapter includes:
  - Start time (milliseconds)
  - End time (milliseconds)
  - Title/name

**Limitation - Per-Chapter Artwork**:
While the code extracts video frames at chapter boundaries, M4A's standard chapter format has limited support for per-chapter images. The current implementation:
- Extracts frames for future use
- Embeds a single main artwork (center-cropped poster)
- Creates chapter markers with titles and timestamps

For true per-chapter artwork, consider:
- M4B audiobook format (same as M4A but with `.m4b` extension)
- Enhanced Podcast format
- Third-party tools like Subler or mp4chaps

### YouTube Premium Authentication

**Method**: Cookie-based authentication via browser extraction

```javascript
yt-dlp --cookies-from-browser firefox URL
```

**How it works**:
1. yt-dlp reads authentication cookies from the specified browser
2. Uses cookies to authenticate as the logged-in user
3. Accesses higher-quality streams and ad-free content
4. Cookies are automatically refreshed by browser

**Supported Browsers**: Firefox (default), Chrome, Safari, Edge, Brave, Opera

**Security Note**: This method accesses your browser's cookie storage. Consider:
- Using a separate browser profile
- Being aware of YouTube's Terms of Service
- Potential account warnings (rare but possible)

### Image Processing

**Main Artwork**:
- Source: Highest resolution thumbnail from YouTube
- Processing: Center crop to square using Sharp library
- Default size: 1000x1000 pixels
- Output format: JPEG (quality 95)
- Embedding: As cover art via ffmpeg `-disposition:v:0 attached_pic`

**Chapter Frame Extraction**:
- Source: Downloaded video file
- Method: ffmpeg frame extraction at chapter start timestamps
- Processing: Center crop to square (same size as main artwork)
- Format: JPEG (quality 90)
- Storage: Temporary files (for future use/manual embedding)

**Center Crop Algorithm** (via Sharp):
```javascript
sharp(input)
  .resize(width, height, {
    fit: 'cover',        // Crop to fill entire area
    position: 'center'   // Center the crop
  })
```

This ensures the most important part of the image (typically center) is preserved.

### Metadata Embedding

Metadata is embedded into each track using ffmpeg with the following mappings:

| Metadata Field | MP4 Atom | Source | Track-Specific? |
|---------------|----------|---------|-----------------|
| Title | `©nam` | Chapter title or "Segment N" | ✓ Yes |
| Artist | `©ART` | Channel/uploader name | No (shared) |
| Album | `©alb` | Video title | No (shared) |
| Album Artist | `aART` | Channel/uploader name | No (shared) |
| Track Number | `trkn` | "N/TOTAL" (e.g., "1/10") | ✓ Yes |
| Year | `©day` | Upload date (YYYY-MM-DD) | No (shared) |
| Genre | `©gen` | User-provided or "Dance & DJ" | No (shared) |
| Compilation | `cpil` | "1" | No (shared) |
| Gapless Playback | Custom | "1" | No (shared) |
| Comment | `©cmt` | Source URL + description | No (shared) |
| Cover Art | `covr` | Processed thumbnail | No (shared) |

**FFmpeg Command Structure (per track)**:
```bash
ffmpeg \
  -ss START_TIME \        # Seek to start position
  -to END_TIME \          # Stop at end position
  -i audio.m4a \          # Input audio (full file)
  -i artwork.jpg \        # Cover artwork
  -map 0:a \              # Map audio stream
  -map 1:v \              # Map artwork stream
  -c:a copy \             # Copy audio codec (no re-encode)
  -c:v copy \             # Copy artwork codec
  -avoid_negative_ts make_zero \ # Fix timestamp issues
  -disposition:v:0 attached_pic \ # Set as cover art
  -metadata title="Track Title" \
  -metadata artist="Uploader" \
  -metadata album="Video Title" \
  -metadata album_artist="Uploader" \
  -metadata track="1/10" \
  -metadata date="2024-01-15" \
  -metadata genre="Genre" \
  -metadata compilation=1 \
  -metadata gapless_playback=1 \
  -metadata comment="Source URL" \
  -movflags +faststart \  # Optimize for streaming
  output_01.m4a
```

**Gapless Playback Implementation**:
- The `gapless_playback=1` metadata flag signals gapless support
- The `compilation=1` flag ensures tracks group as a single album
- All tracks have identical album name, artist, and album_artist
- Track numbers use format "N/TOTAL" for proper ordering

### Configuration System

**Environment Variables** (via .env file):

- `YOUTUBE_MUSIC_DIR`: Output directory for downloaded files
  - Default: `~/Music/YouTube`
  - Supports `~` expansion for home directory

- `BROWSER_FOR_COOKIES`: Browser for cookie extraction
  - Default: `firefox`
  - Options: firefox, chrome, safari, edge, brave, opera, vivaldi

- `ARTWORK_SIZE`: Square dimension for artwork (pixels)
  - Default: `1000`
  - Recommended: 800-1400 for balance of quality/size

- `AUDIO_QUALITY`: yt-dlp audio quality setting
  - Default: `0` (best)
  - Range: 0 (best) to 10 (worst)

### Error Handling

The implementation includes error handling for:

1. **Missing Dependencies**: Checks for yt-dlp, ffmpeg, ffprobe at startup
2. **Invalid URLs**: Validates YouTube URL format
3. **Download Failures**: Catches yt-dlp errors with informative messages
4. **Processing Errors**: Try-catch blocks around ffmpeg operations
5. **Cleanup**: Ensures temporary files are removed even on failure

### Temporary File Management

**Temporary Directory**: `./temp/` (created in current working directory)

**Temporary Files**:
- `info.json`: Video metadata from yt-dlp
- `audio.*`: Downloaded audio file (various extensions)
- `video.*`: Downloaded video (only if chapters exist)
- `thumb.*`: Original thumbnail
- `artwork.jpg`: Processed main artwork
- `chapter-N.jpg`: Extracted chapter frames
- `metadata.txt`: FFMETADATA1 file

**Cleanup Strategy**:
- All temporary files are deleted after successful processing
- Temporary directory is removed
- On error, manual cleanup may be needed

## Performance Considerations

### Download Optimization

- **Audio-only when possible**: Skips video download if no chapters
- **Format preference**: Prefers M4A to avoid transcoding
- **Cookie authentication**: Accesses best available quality
- **No re-encoding**: Uses `-c:a copy` in ffmpeg to preserve quality

### Image Processing

- **Sharp library**: Native C++ bindings for fast processing
- **Quality settings**: Balanced JPEG quality (90-95) for size/quality
- **Single-pass resize**: Center crop + resize in one operation

### Concurrent Operations

Current implementation is sequential for simplicity. Potential optimizations:
- Parallel download of audio + thumbnail
- Async frame extraction for multiple chapters
- Batch ffmpeg operations

## Known Limitations

### 1. Per-Chapter Artwork

M4A chapter format has limited support for per-chapter images in standard players. While frames are extracted, they're not embedded per-chapter.

**Workaround**: Use M4B format with tools like Subler for true per-chapter artwork.

### 2. SponsorBlock Integration

Current implementation does not integrate SponsorBlock for automatic sponsor segment marking.

**Future Enhancement**: Could add `--sponsorblock-mark all` to yt-dlp options.

### 3. Playlist Support

Single-URL only. No batch processing or playlist download.

**Future Enhancement**: Detect playlists and loop through videos.

### 4. Codec Support

Assumes AAC audio is available. Some older videos may only have Opus or Vorbis.

**Current Behavior**: yt-dlp will transcode to M4A using ffmpeg if needed.

## Apple Music Compatibility

### Tested Platforms

- macOS Sonoma 14+ (Music app)
- iOS 17+ (Music app)
- iPadOS 17+ (Music app)

### Import Method

Drag-and-drop M4A file into Music app or use:
```bash
open -a Music "/path/to/file.m4a"
```

### Metadata Preservation

All metadata fields are preserved when importing to Music:
- Title, Artist, Album, Year display correctly
- Cover artwork appears in Now Playing
- Chapters are accessible via chapter menu
- File remains in original location (not copied to Media folder unless configured)

## Development Notes

### Adding New Features

**To add a new metadata field**:
1. Add to ffmpeg `-metadata` flags in `experiment.red.js`
2. Update MP4 atom mapping table in this doc

**To support additional output formats**:
1. Modify yt-dlp format selection
2. Adjust ffmpeg codec parameters
3. Update file extension handling

**To add SponsorBlock**:
1. Add `--sponsorblock-mark all` to yt-dlp command
2. Merge SponsorBlock chapters with native chapters
3. Deduplicate overlapping segments

### Testing

**Manual Testing Scenarios**:
1. Video with chapters (DJ set with track list)
2. Video without chapters (standard music video)
3. Long-form content (podcast, lecture)
4. High-quality audio (music video from official channel)
5. YouTube Premium exclusive content

**Test Command**:
```bash
node experiment.red.js "https://youtube.com/watch?v=TEST_ID"
```

## References

### External Documentation

- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp#readme)
- [FFmpeg MP4 Metadata](https://wiki.multimedia.cx/index.php/FFmpeg_Metadata)
- [QuickTime Chapter Format](https://developer.apple.com/documentation/quicktime-file-format)
- [MP4 Container Specification](https://www.iso.org/standard/68960.html)

### Tools

- yt-dlp: https://github.com/yt-dlp/yt-dlp
- FFmpeg: https://ffmpeg.org
- Sharp: https://sharp.pixelplumbing.com
- Subler (for advanced M4A editing): https://subler.org

## Changelog

### v1.0.0 (Initial Release)
- YouTube audio download with yt-dlp
- M4A output format
- Center-cropped artwork embedding
- Chapter support with frame extraction
- YouTube Premium cookie authentication
- Configurable output directory via .env
- Metadata preservation (title, artist, album, year)
