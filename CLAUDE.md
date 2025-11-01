# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**experiment.red** (aka mix-extractor) - A command-line tool for downloading high-quality audio from YouTube videos with chapter support and Apple Music compatibility. Built with Node.js/Bun, primarily for downloading DJ sets and podcasts from YouTube.

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
2. **Audio Download** - Download best quality M4A audio
3. **Thumbnail Download** - Get highest resolution poster image
4. **Image Processing** - Center-crop artwork to square using Sharp
5. **[Conditional] Video Download** - Only if chapters exist, download video for frame extraction
6. **[Conditional] Frame Extraction** - Extract video frames at each chapter boundary
7. **Metadata Assembly** - Create FFMETADATA1 file with chapter information
8. **Final Assembly** - Use ffmpeg to embed metadata, chapters, and artwork into M4A
9. **Cleanup** - Remove all temporary files

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
- `chapter-N.jpg` - Extracted frames at chapter boundaries
- `metadata.txt` - FFMETADATA1 file for ffmpeg

All temporary files are deleted after successful completion.

## Important Implementation Notes

### Chapter Artwork Limitation

While the code extracts video frames at chapter boundaries, **M4A's standard chapter format has limited support for per-chapter artwork** in most players. The current implementation:
- Extracts frames (for future use or manual embedding)
- Embeds a single main artwork (center-cropped poster)
- Creates chapter markers with titles and timestamps

For true per-chapter artwork, would need M4B format or enhanced podcast format.

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

1. Add ffmpeg `-metadata` flag in the final assembly step (experiment.red.js:~460)
2. Extract the field from `info` JSON object
3. Update the metadata table in docs/experiment.red.md

### Supporting Additional Output Formats

1. Modify yt-dlp format selection (experiment.red.js:~200)
2. Adjust ffmpeg codec parameters (experiment.red.js:~440)
3. Update file extension handling throughout

### Enabling SponsorBlock Integration

Add to yt-dlp command:
```javascript
'--sponsorblock-mark', 'all'
```

Then merge SponsorBlock chapters with native chapters before creating FFMETADATA.

## Testing Strategy

Since this tool interfaces with external services (YouTube) and CLI tools, testing is primarily manual:

**Test Cases**:
1. Video with chapters (DJ set with track list)
2. Video without chapters (standard music video)
3. Long-form content (podcast, 1+ hour)
4. YouTube Premium exclusive content
5. Various thumbnail aspect ratios (vertical, horizontal, square)

**Verification**:
- Check M4A file plays in Apple Music
- Verify chapters appear in chapter menu
- Confirm artwork displays correctly
- Validate metadata fields (title, artist, album, year)

## Documentation

- **README.md** - User-facing guide (installation, usage, troubleshooting)
- **docs/experiment.red.md** - Technical documentation (architecture, implementation, API details)
- **CLAUDE.md** - This file (AI assistant guidance for code changes)

## Known Issues & Limitations

- No playlist support (single video only)
- No batch processing
- Per-chapter artwork extraction works but embedding is limited by M4A format
- No SponsorBlock integration (planned enhancement)
- Sequential processing (could be parallelized for better performance)
