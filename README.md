# experiment.red

YouTube audio downloader for DJ sets and podcasts with high-quality audio, chapter support, and Apple Music compatibility.

## Features

- Download best quality audio from YouTube in M4A format
- Preserve audio quality (no unnecessary transcoding)
- Center-cropped poster artwork embedded as cover art
- Chapter support with frame extraction at chapter boundaries
- YouTube Premium authentication for ad-free, highest quality streams
- Metadata embedding (title, artist, album, year)
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

The downloaded M4A file will be saved to your configured `YOUTUBE_MUSIC_DIR` (default: `~/Music/YouTube`) with the video title as the filename.

The file will include:
- High-quality AAC audio
- Embedded cover artwork (center-cropped poster)
- Chapter markers (if the video has chapters)
- Metadata (title, artist/uploader, album, year)

## YouTube Premium

If you have a YouTube Premium account, the tool will automatically use your browser cookies to:
- Access ad-free streams
- Download higher quality audio (up to 256 kbps AAC)
- Avoid interruptions

Make sure you're logged into YouTube in the browser specified in your `.env` file (default: Firefox).

## Importing to Apple Music

### Drag and Drop

Simply drag the downloaded M4A file into the Music app.

### Command Line

```bash
open -a Music "/path/to/downloaded/file.m4a"
```

The file will appear in your Music library with all metadata, artwork, and chapters intact.

## Chapter Support

If the YouTube video has chapters:
- Chapter markers will be embedded in the M4A file
- Chapter titles will be preserved
- Video frames at each chapter boundary will be extracted (saved temporarily)
- Chapters will be accessible in Music app's chapter menu

**Note**: While chapter frames are extracted, M4A format has limited support for per-chapter artwork in most players. The main poster artwork is used for all chapters.

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
- Per-chapter artwork extraction is limited by M4A format constraints
- No SponsorBlock integration (yet)
- Sequential processing (not optimized for bulk downloads)

## Future Enhancements

- Playlist support
- SponsorBlock integration for automatic chapter markers
- M4B audiobook format option for better chapter artwork
- Batch processing mode
- GUI frontend
- Chapter editing capabilities

## License

MIT

## Disclaimer

This tool is for personal use only. Respect YouTube's Terms of Service and copyright laws. Only download content you have permission to download.
