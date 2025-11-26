# experiment.red

YouTube audio downloader for DJ sets and podcasts that creates multi-track albums with gapless playback for Apple Music.

## Features

- Download best quality audio from YouTube in M4A format
- **Multi-track album output** - creates separate tracks from chapters or 5-minute segments
- **Gapless playback** - seamless transitions between tracks in Apple Music
- Preserve audio quality (no unnecessary transcoding)
- Center-cropped poster artwork embedded in all tracks
- Chapter-based or time-based segmentation
- YouTube Premium authentication for ad-free, highest quality streams
- Full metadata embedding (title, artist, album, year, track numbers)
- Optimized for Apple Music on macOS/iOS/iPadOS

## Installation

### Prerequisites

Install system dependencies via Homebrew:

```bash
brew install yt-dlp ffmpeg
```

### Install Node.js Dependencies

Using npm:
```bash
npm install
```

Or using Bun (faster):
```bash
bun install
```

### Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` to customize settings:
```bash
# Directory where downloaded audio files will be saved
YOUTUBE_MUSIC_DIR=~/Music/YouTube

# Browser to extract cookies from (for YouTube Premium)
BROWSER_FOR_COOKIES=firefox

# Artwork size (pixels)
ARTWORK_SIZE=1000

# Audio quality (0=best, 10=worst)
AUDIO_QUALITY=0
```

## Usage

### Basic Usage

Download a YouTube video as high-quality audio:

```bash
node experiment.red.js "https://www.youtube.com/watch?v=VIDEO_ID"
```

Or with Bun:

```bash
bun experiment.red.js "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Examples

Download a DJ set:
```bash
node experiment.red.js "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

Download a podcast episode:
```bash
bun experiment.red.js "https://youtu.be/SHORT_URL"
```

### Output

The tool creates an **album folder** in your configured `YOUTUBE_MUSIC_DIR` (default: `~/Music/YouTube`) named after the video title.

**Example output structure:**
```
~/Music/YouTube/
└── Amazing DJ Set - Boiler Room/
    ├── 01 - Opening Track.m4a
    ├── 02 - Second Track.m4a
    ├── 03 - Third Track.m4a
    └── ...
```

**Track segmentation:**
- Videos with chapters: One track per chapter (using chapter titles)
- Videos without chapters: 5-minute segments (named "Segment 1", "Segment 2", etc.)

**Each track includes:**
- High-quality AAC audio (no re-encoding)
- Embedded cover artwork (center-cropped poster)
- Full metadata (title, artist/uploader, album, year, track number)
- Gapless playback tags for seamless listening
- Compilation flag for proper album grouping

## YouTube Premium

If you have a YouTube Premium account, the tool will automatically use your browser cookies to:
- Access ad-free streams
- Download higher quality audio (up to 256 kbps AAC)
- Avoid interruptions

Make sure you're logged into YouTube in the browser specified in your `.env` file (default: Firefox).

## Importing to Apple Music

### Drag and Drop

Drag the entire album folder into the Music app. All tracks will be imported as a single album.

### Command Line

```bash
open -a Music "/path/to/album/folder"
```

The album will appear in your Music library with:
- All tracks grouped as a single album
- Proper track ordering (01, 02, 03, etc.)
- Gapless playback enabled for seamless listening
- Full metadata and artwork on all tracks

### Verifying Gapless Playback

After importing:
1. Play the album in Apple Music
2. Listen to track transitions - there should be no gaps or silence
3. Check the "Gapless Album" checkbox in album info (should be auto-enabled)

## Album Organization

**Videos with chapters** (e.g., DJ sets with tracklists):
- Each chapter becomes a separate track
- Track names use the chapter titles from YouTube
- Perfect for mixes where each track is a different song

**Videos without chapters** (e.g., podcasts, long mixes):
- Audio is split into 5-minute segments
- Track names are "Segment 1", "Segment 2", etc.
- Gapless playback ensures continuous listening experience

**Why multi-track instead of single file?**
- Better organization in music apps
- Easier to navigate long content
- Can skip between segments
- Still plays continuously without gaps

## Troubleshooting

### "Missing required tools: yt-dlp, ffmpeg"

Install the missing tools:
```bash
brew install yt-dlp ffmpeg
```

### "Command failed with code 1"

This usually means yt-dlp encountered an error. Common causes:
- Invalid YouTube URL
- Video is private or deleted
- Network connection issues
- YouTube rate limiting

Try running yt-dlp directly to see the error:
```bash
yt-dlp "YOUR_URL"
```

### "No audio file downloaded"

The video may use an unsupported format or codec. Check yt-dlp's output:
```bash
yt-dlp -F "YOUR_URL"
```

This shows all available formats. The tool prefers M4A audio but will transcode if needed.

### YouTube Premium not working

Make sure:
1. You're logged into YouTube in the correct browser
2. The browser name in `.env` matches your browser (firefox, chrome, safari, etc.)
3. Your browser profile is the default one (or configure yt-dlp to use a specific profile)

### Cookies error

If you see cookie-related errors:
- Update yt-dlp: `brew upgrade yt-dlp`
- Log out and back into YouTube in your browser
- Try a different browser

## Advanced Usage

### Change Output Directory Per Download

Override the environment variable:
```bash
YOUTUBE_MUSIC_DIR=~/Downloads node experiment.red.js "URL"
```

### Use Different Browser for Cookies

```bash
BROWSER_FOR_COOKIES=chrome node experiment.red.js "URL"
```

### High-Resolution Artwork

```bash
ARTWORK_SIZE=1400 node experiment.red.js "URL"
```

### Display Help

```bash
node experiment.red.js
```

This shows current configuration and usage instructions.

## File Structure

```
mix-extractor/
├── experiment.red.js       # Main script
├── package.json        # Dependencies
├── .env                # Your configuration (not in git)
├── .env.example        # Example configuration
├── README.md           # This file
├── CLAUDE.md           # AI assistant guidance
└── docs/
    └── experiment.red.md  # Technical documentation
```

## Technical Details

For implementation details, architecture, and development notes, see [docs/experiment.red.md](docs/experiment.red.md).

## Limitations

- Single video downloads only (no playlists)
- Sequential track processing (not parallelized)
- No SponsorBlock integration (yet)
- Track segmentation is fixed at 5 minutes for videos without chapters

## Future Enhancements

- Playlist support
- SponsorBlock integration for automatic chapter markers
- Parallel track processing for faster album creation
- Configurable segment duration
- Batch processing mode
- GUI frontend

## License

MIT

## Disclaimer

This tool is for personal use only. Respect YouTube's Terms of Service and copyright laws. Only download content you have permission to download.
