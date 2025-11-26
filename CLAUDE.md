# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**experiment.red** (aka mix-extractor) - A command-line tool for downloading high-quality audio from YouTube videos and creating multi-track albums with gapless playback for Apple Music. Built with Node.js/Bun, primarily for downloading DJ sets and podcasts from YouTube.

**Key Features:**
- Multi-track album output (one track per chapter or 5-minute segments)
- Gapless playback support via iTunes metadata tags
- Chapter-based or time-based segmentation
- High-quality M4A audio with embedded artwork

**Project Name**: The official project name is "experiment.red" but the repository is called "mix-extractor".

## Development Commands

### Setup
```bash
# Install system dependencies (macOS)
brew install yt-dlp ffmpeg

# Install Node dependencies
npm install
# or
bun install

# Configure environment
cp .env.example .env
# Edit .env to set YOUTUBE_MUSIC_DIR and other settings
```

### Running the Tool
```bash
# With Node
node experiment.red.js "https://youtube.com/watch?v=VIDEO_ID"

# With Bun (faster)
bun experiment.red.js "https://youtube.com/watch?v=VIDEO_ID"

# Display help and current configuration
node experiment.red.js
```

### Testing
```bash
# Test with a short video
node experiment.red.js "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Check output directory
ls ~/Music/YouTube/
```

## Architecture

### High-Level Structure

The tool is a **single-file Node.js script** (`experiment.red.js`) that orchestrates multiple CLI tools to download and process YouTube audio.

**Pipeline Flow**:
1. **Metadata Fetch** - Download video info JSON via yt-dlp
2. **Segment Generation** - Determine track boundaries (chapters or 5-min chunks)
3. **Audio Download** - Download best quality M4A audio
4. **Thumbnail Download** - Get highest resolution poster image
5. **Image Processing** - Center-crop artwork to square using Sharp
6. **[Conditional] Video Download** - Only if chapters exist, download video for frame extraction
7. **[Conditional] Frame Extraction** - Extract video frames at each chapter boundary (for future use)
8. **Album Creation** - Create album directory and generate multiple track files
9. **Track Processing** - For each segment, use ffmpeg to split audio and embed metadata
10. **Cleanup** - Remove all temporary files

### Key Technology Decisions

**Why Node.js/Bun instead of Python?**
- User preference (more comfortable with JavaScript than Python)
- Excellent subprocess/CLI orchestration capabilities
- Built-in .env support (Bun) or simple dotenv package (Node)
- Sharp library for fast image processing

**Why M4A instead of MP3?**
- Native format for Apple Music/iTunes ecosystem
- Better chapter support (QuickTime chapters)
- Better quality-to-size ratio with AAC codec
- No transcoding needed from YouTube's AAC streams

**Why CLI orchestration instead of libraries?**
- yt-dlp CLI is battle-tested and feature-complete
- ffmpeg CLI provides maximum flexibility for metadata embedding
- Simpler than managing Python/library dependencies
- Easier to debug (can run commands manually)

### Dependencies

**System (via Homebrew)**:
- `yt-dlp` - YouTube download, metadata extraction, format selection
- `ffmpeg` - Audio processing, metadata embedding, frame extraction
- `ffprobe` - Media file inspection (comes with ffmpeg)

**npm Packages**:
- `sharp` - Fast image processing (center-cropping)
- `dotenv` - Environment variable loading from .env file

### File Structure

```
experiment.red.js           # Main script - all logic in one file
package.json            # Node.js dependencies
.env                    # User configuration (gitignored)
.env.example           # Configuration template
README.md              # User-facing documentation
CLAUDE.md              # This file - AI assistant guidance
docs/
  experiment.red.md    # Technical documentation (architecture, implementation details)
temp/                  # Temporary directory (created during processing, cleaned up after)
```

### Configuration System

All configuration via **environment variables** loaded from `.env`:

- `YOUTUBE_MUSIC_DIR` - Output directory (default: `~/Music/YouTube`)
- `BROWSER_FOR_COOKIES` - Browser for YouTube Premium auth (default: `firefox`)
- `ARTWORK_SIZE` - Square artwork dimension in pixels (default: `1000`)
- `AUDIO_QUALITY` - yt-dlp quality setting 0-10 (default: `0` = best)

### Temporary Files

During processing, the script creates a `temp/` directory with:
- `info.json` - Video metadata from yt-dlp
- `audio.*` - Downloaded audio file
- `video.*` - Downloaded video (only if chapters exist)
- `thumb.*` - Original thumbnail
- `artwork.jpg` - Processed center-cropped artwork
- `chapter-N.jpg` - Extracted frames at chapter boundaries (for future use)

All temporary files are deleted after successful completion.

## Important Implementation Notes

### Multi-Track Album Output

The tool creates an album of multiple tracks instead of a single long file:
- **With chapters**: One track per chapter, using chapter titles
- **Without chapters**: 5-minute segments, named "Segment 1", "Segment 2", etc.
- Each track is created using ffmpeg with `-ss` and `-to` flags for frame-accurate splitting
- Uses `-c:a copy` to avoid re-encoding (preserves quality)
- Adds `-avoid_negative_ts make_zero` to fix timestamp issues at boundaries

### Gapless Playback

All tracks include iTunes gapless metadata for seamless playback:
- `gapless_playback=1` metadata flag
- `compilation=1` flag for proper album grouping
- Consistent album name, artist, and album_artist across all tracks
- Track numbers in format "N/TOTAL" (e.g., "1/10", "2/10")

### Chapter Frame Extraction

While the code still extracts video frames at chapter boundaries, they are currently unused in the multi-track output. These frames are preserved for potential future features (e.g., per-track artwork variation).

### YouTube Premium Authentication

Uses `--cookies-from-browser` flag to extract cookies from the user's browser. This:
- Provides access to higher quality streams (up to 256 kbps AAC)
- Enables ad-free downloads
- Requires user to be logged into YouTube in the specified browser
- No manual cookie export needed

### No Re-encoding

The script uses `-c:a copy` in ffmpeg to avoid re-encoding audio, preserving the original quality from YouTube.

### Error Handling

The script checks for missing dependencies at startup and provides helpful error messages with installation instructions.

## Common Development Tasks

### Adding New Metadata Fields

1. Add field to `commonMetadata` object in experiment.red.js (~464)
2. Extract the field from `info` JSON object
3. Update the metadata table in docs/experiment.red.md

### Modifying Track Segmentation

To change the 5-minute default for videos without chapters:
1. Modify the `generateTimeBasedSegments` call in experiment.red.js (~323)
2. Change the second parameter (currently `300` seconds)
3. Consider adding a configuration option to `.env`

### Supporting Additional Output Formats

1. Modify yt-dlp format selection (experiment.red.js:~290)
2. Adjust ffmpeg codec parameters in `createTrack` function (experiment.red.js:~210)
3. Update file extension handling in `generateTrackFilename` (experiment.red.js:~205)

### Enabling SponsorBlock Integration

Add to yt-dlp command and merge with native chapters:
```javascript
'--sponsorblock-mark', 'all'
```

Then use SponsorBlock chapters as segment boundaries instead of fixed 5-minute chunks.

## Testing Strategy

Since this tool interfaces with external services (YouTube) and CLI tools, testing is primarily manual:

**Test Cases**:
1. Video with chapters (DJ set with track list)
   - Should create one track per chapter
   - Track names should match chapter titles
2. Video without chapters (standard music video or podcast)
   - Should create 5-minute segments
   - Track names should be "Segment 1", "Segment 2", etc.
3. Long-form content (podcast, 1+ hour)
   - Should handle many tracks (12+ for hour-long content)
4. Short video (< 5 minutes, no chapters)
   - Should create single track in album folder
5. YouTube Premium exclusive content
   - Should download highest quality audio
6. Various thumbnail aspect ratios (vertical, horizontal, square)
   - Artwork should be properly centered and cropped

**Verification**:
- Check album folder is created with correct name
- Verify all tracks are numbered sequentially (01, 02, 03...)
- Import to Apple Music and verify tracks appear as single album
- Test gapless playback (no silence between tracks)
- Confirm artwork displays correctly on all tracks
- Validate metadata fields (title, artist, album, year, track numbers)
- Check compilation flag and gapless_playback metadata using ffprobe

## Documentation

- **README.md** - User-facing guide (installation, usage, troubleshooting)
- **docs/experiment.red.md** - Technical documentation (architecture, implementation, API details)
- **CLAUDE.md** - This file (AI assistant guidance for code changes)

## Known Issues & Limitations

- No playlist support (single video only)
- No batch processing
- Sequential track processing (could be parallelized for better performance)
- Fixed 5-minute segmentation for videos without chapters (not configurable yet)
- No SponsorBlock integration (planned enhancement)
- Chapter frame extraction still runs but frames are unused in current implementation
