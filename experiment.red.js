#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, rmSync } from 'fs';
import { join, basename, dirname } from 'path';
import { homedir } from 'os';
import sharp from 'sharp';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration from environment
const CONFIG = {
  musicDir: (process.env.YOUTUBE_MUSIC_DIR || '~/Music/YouTube').replace('~', homedir()),
  browser: process.env.BROWSER_FOR_COOKIES || 'firefox',
  artworkSize: parseInt(process.env.ARTWORK_SIZE || '1000'),
  audioQuality: parseInt(process.env.AUDIO_QUALITY || '0'),
};

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message) {
  log(`ERROR: ${message}`, colors.red);
}

function success(message) {
  log(`✓ ${message}`, colors.green);
}

function info(message) {
  log(`→ ${message}`, colors.blue);
}

// Helper to run shell commands
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });

    let stdout = '';
    let stderr = '';

    if (options.silent) {
      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });
    }

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
      }
    });

    proc.on('error', reject);
  });
}

// Check if required tools are installed
function checkDependencies() {
  const tools = ['yt-dlp', 'ffmpeg', 'ffprobe'];
  const missing = [];

  for (const tool of tools) {
    try {
      execSync(`which ${tool}`, { stdio: 'ignore' });
    } catch (e) {
      missing.push(tool);
    }
  }

  if (missing.length > 0) {
    error(`Missing required tools: ${missing.join(', ')}`);
    log('\nInstall them with:');
    log(`  brew install ${missing.join(' ')}`);
    process.exit(1);
  }
}

// Extract video ID from URL
function getVideoId(url) {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([^&?/]+)/);
  return match ? match[1] : null;
}

// Sanitize filename
function sanitizeFilename(name) {
  return name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// Create square artwork with blurred background
async function createArtworkWithBlurredBackground(inputPath, outputPath, size) {
  info(`Creating ${size}x${size} artwork with blurred background...`);

  const image = sharp(inputPath);
  const metadata = await image.metadata();

  // Create blurred background - zoom to fill and blur heavily
  const background = await sharp(inputPath)
    .resize(size, size, {
      fit: 'cover',
      position: 'center',
    })
    .blur(50) // Heavy blur for background
    .modulate({
      brightness: 0.6, // Darken the background a bit
    })
    .toBuffer();

  // Calculate dimensions to fit width while maintaining aspect ratio
  const aspectRatio = metadata.width / metadata.height;
  const finalWidth = size;
  const finalHeight = Math.round(size / aspectRatio);

  // Resize the original image to fit width
  const foreground = await sharp(inputPath)
    .resize(finalWidth, finalHeight, {
      fit: 'inside',
      withoutEnlargement: false,
    })
    .toBuffer();

  // Calculate vertical centering
  const topOffset = Math.round((size - finalHeight) / 2);

  // Composite foreground onto blurred background
  await sharp(background)
    .composite([{
      input: foreground,
      top: topOffset,
      left: 0,
    }])
    .jpeg({ quality: 95 })
    .toFile(outputPath);

  success('Artwork created');
}

// Extract video frame at specific timestamp
async function extractFrame(videoPath, timestamp, outputPath, size) {
  try {
    const tempFramePath = outputPath + '.temp.jpg';

    await runCommand('ffmpeg', [
      '-ss', timestamp.toString(),
      '-i', videoPath,
      '-vframes', '1',
      '-y',
      tempFramePath,
    ], { silent: true });

    // Create artwork with blurred background
    await createArtworkWithBlurredBackground(tempFramePath, outputPath, size);

    // Clean up temp file
    unlinkSync(tempFramePath);
  } catch (e) {
    error(`Failed to extract frame at ${timestamp}: ${e.message}`);
  }
}

// Format seconds to HH:MM:SS timestamp
function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Generate time-based segments for videos without chapters
function generateTimeBasedSegments(duration, chunkDuration) {
  const segments = [];
  const totalSegments = Math.ceil(duration / chunkDuration);

  for (let i = 0; i < totalSegments; i++) {
    const startTime = i * chunkDuration;
    const endTime = Math.min((i + 1) * chunkDuration, duration);

    segments.push({
      startTime,
      endTime,
      title: `Segment ${i + 1} (${formatTimestamp(startTime)})`,
    });
  }

  return segments;
}

// Generate filename for track with padded number
function generateTrackFilename(trackNum, totalTracks, title) {
  const paddedNumber = trackNum.toString().padStart(2, '0');
  return `${paddedNumber} - ${sanitizeFilename(title)}.m4a`;
}

// Create individual track with metadata and artwork
async function createTrack(inputAudio, startTime, endTime, outputPath, metadata, artworkPath) {
  const ffmpegArgs = [
    '-ss', startTime.toString(),
    '-to', endTime.toString(),
    '-i', inputAudio,
  ];

  // Add artwork if available
  if (existsSync(artworkPath)) {
    ffmpegArgs.push('-i', artworkPath);
  }

  ffmpegArgs.push(
    '-map', '0:a',
    '-c:a', 'copy',
    '-avoid_negative_ts', 'make_zero',
  );

  // Add artwork as cover
  if (existsSync(artworkPath)) {
    ffmpegArgs.push(
      '-map', '1:v',
      '-c:v', 'copy',
      '-disposition:v:0', 'attached_pic',
    );
  }

  // Add all metadata
  Object.entries(metadata).forEach(([key, value]) => {
    ffmpegArgs.push('-metadata', `${key}=${value}`);
  });

  ffmpegArgs.push(
    '-movflags', '+faststart',
    '-y',
    outputPath,
  );

  await runCommand('ffmpeg', ffmpegArgs, { silent: true });
}

// Main download and processing function
async function downloadAndProcess(url, options = {}) {
  const videoId = getVideoId(url);
  if (!videoId) {
    throw new Error('Could not extract video ID from URL');
  }

  const tempDir = join(process.cwd(), 'temp', videoId);
  mkdirSync(tempDir, { recursive: true });

  info(`Video ID: ${videoId}`);
  info(`Temp directory: ${tempDir}`);

  try {
    // Step 1: Download metadata first to get info
    const infoPath = join(tempDir, 'video.info.json');

    if (existsSync(infoPath) && !options.forceRedownload) {
      info('Using cached video information...');
    } else {
      info('Fetching video information...');
      await runCommand('yt-dlp', [
        '--write-info-json',
        '--skip-download',
        '-o', join(tempDir, 'video'),
        url,
      ], { silent: true });
    }

    const videoInfo = JSON.parse(readFileSync(infoPath, 'utf-8'));
    const title = sanitizeFilename(videoInfo.title);
    const uploader = sanitizeFilename(videoInfo.uploader || 'Unknown');
    const uploadDate = videoInfo.upload_date ?
      `${videoInfo.upload_date.slice(0, 4)}-${videoInfo.upload_date.slice(4, 6)}-${videoInfo.upload_date.slice(6, 8)}` :
      new Date().toISOString().split('T')[0];

    // Use playlist title as album if available, otherwise use video title
    const album = videoInfo.playlist_title
      ? sanitizeFilename(videoInfo.playlist_title)
      : title;

    // Create comment field with description and URL
    const videoUrl = videoInfo.webpage_url || url;
    let comment = '';
    if (videoInfo.description) {
      comment = videoInfo.description.trim();
      comment += '\n\n';
    }
    comment += `Source: ${videoUrl}`;

    success(`Title: ${title}`);
    success(`Uploader: ${uploader}`);
    if (videoInfo.playlist_title) {
      success(`Playlist: ${album}`);
    }
    success(`Upload date: ${uploadDate}`);

    const hasChapters = videoInfo.chapters && videoInfo.chapters.length > 0;
    if (hasChapters) {
      success(`Found ${videoInfo.chapters.length} chapters`);
    } else {
      info('No chapters found in video');
    }

    // Determine segmentation strategy
    const segments = hasChapters
      ? videoInfo.chapters.map((ch, i) => ({
          startTime: ch.start_time,
          endTime: ch.end_time,
          title: sanitizeFilename(ch.title || `Segment ${i + 1}`),
        }))
      : generateTimeBasedSegments(videoInfo.duration, 300);

    info(`Creating album with ${segments.length} track${segments.length > 1 ? 's' : ''}...`);

    // Prompt for genre if not provided via command line
    if (!options.genre) {
      log('');
      options.genre = await promptUser('Enter genre', 'Dance & DJ');
    }

    // Step 2: Download audio
    const audioFiles = readdirSync(tempDir).filter(f => f.startsWith('audio.') && (f.endsWith('.m4a') || f.endsWith('.webm')));
    let audioFile = audioFiles.length > 0 ? join(tempDir, audioFiles[0]) : null;

    if (audioFile && existsSync(audioFile) && !options.forceRedownload) {
      info('Using cached audio file...');
      success('Audio found in cache');
    } else {
      info('Downloading audio...');
      const audioOutputTemplate = join(tempDir, 'audio.%(ext)s');
      const audioArgs = [
        '-f', 'bestaudio/best',
        '--extract-audio',
        '--audio-format', 'm4a',
        '--audio-quality', CONFIG.audioQuality.toString(),
        '--postprocessor-args', 'ffmpeg:-c:a aac -b:a 256k',
      ];

      // Only add cookies if browser is configured
      if (CONFIG.browser && CONFIG.browser !== 'none') {
        audioArgs.push('--cookies-from-browser', CONFIG.browser);
      }

      audioArgs.push('-o', audioOutputTemplate, url);

      console.log(''); // blank line
      info('yt-dlp output (you can ignore messages about -k flag):');
      console.log('─'.repeat(60));
      await runCommand('yt-dlp', audioArgs);
      console.log('─'.repeat(60));

      // Find the downloaded audio file
      const newAudioFiles = readdirSync(tempDir).filter(f => f.startsWith('audio.') && (f.endsWith('.m4a') || f.endsWith('.webm')));
      if (newAudioFiles.length === 0) {
        throw new Error('No audio file downloaded');
      }
      audioFile = join(tempDir, newAudioFiles[0]);
      success('Audio downloaded');
    }

    // Step 3: Download thumbnail
    const artworkPath = join(tempDir, 'artwork.jpg');

    if (existsSync(artworkPath) && !options.forceRedownload) {
      info('Using cached artwork...');
      success('Artwork found in cache');
    } else {
      info('Downloading thumbnail...');
      await runCommand('yt-dlp', [
        '--write-thumbnail',
        '--skip-download',
        '--convert-thumbnails', 'jpg',
        '-o', join(tempDir, 'thumb'),
        url,
      ], { silent: true });

      const thumbFiles = readdirSync(tempDir).filter(f => f.startsWith('thumb.'));
      const thumbFile = thumbFiles.length > 0 ? join(tempDir, thumbFiles[0]) : null;

      if (thumbFile) {
        await createArtworkWithBlurredBackground(thumbFile, artworkPath, CONFIG.artworkSize);
      } else {
        error('No thumbnail found');
      }
    }

    // Step 4: Download video if chapters exist (for frame extraction)
    let videoFile = null;
    const chapterArtworks = [];

    if (hasChapters) {
      const videoFiles = readdirSync(tempDir).filter(f => f.startsWith('video.') && !f.endsWith('.info.json') && (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv')));
      videoFile = videoFiles.length > 0 ? join(tempDir, videoFiles[0]) : null;

      if (videoFile && existsSync(videoFile) && !options.forceRedownload) {
        info('Using cached video file...');
        success('Video found in cache');
      } else {
        info('Downloading video for chapter frame extraction...');
        const videoOutputTemplate = join(tempDir, 'video.%(ext)s');
        const videoArgs = [
          '-f', 'best[ext=mp4]/best',
        ];

        // Only add cookies if browser is configured
        if (CONFIG.browser && CONFIG.browser !== 'none') {
          videoArgs.push('--cookies-from-browser', CONFIG.browser);
        }

        videoArgs.push('-o', videoOutputTemplate, url);
        await runCommand('yt-dlp', videoArgs, { silent: true });

        const newVideoFiles = readdirSync(tempDir).filter(f => f.startsWith('video.') && !f.endsWith('.info.json') && (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv')));
        if (newVideoFiles.length > 0) {
          videoFile = join(tempDir, newVideoFiles[0]);
          success('Video downloaded for frame extraction');
        }
      }

      if (videoFile) {
        // Check if chapter frames already exist
        const existingFrames = readdirSync(tempDir).filter(f => f.startsWith('chapter-') && f.endsWith('.jpg'));

        if (existingFrames.length === videoInfo.chapters.length && !options.forceRedownload) {
          info('Using cached chapter frames...');
          for (let i = 0; i < videoInfo.chapters.length; i++) {
            chapterArtworks.push(join(tempDir, `chapter-${i}.jpg`));
          }
          success('Chapter frames found in cache');
        } else {
          // Extract frames for each chapter
          info(`Extracting ${videoInfo.chapters.length} chapter frames...`);
          for (let i = 0; i < videoInfo.chapters.length; i++) {
            const chapter = videoInfo.chapters[i];
            const framePath = join(tempDir, `chapter-${i}.jpg`);
            await extractFrame(videoFile, chapter.start_time, framePath, CONFIG.artworkSize);
            chapterArtworks.push(framePath);
          }
          success('Chapter frames extracted');
        }
      }
    }

    // Step 5: Create album with multiple tracks
    const albumDirName = sanitizeFilename(title);
    const albumPath = join(CONFIG.musicDir, albumDirName);
    mkdirSync(albumPath, { recursive: true });

    info('Creating album tracks...');

    // Prepare common metadata for all tracks
    const commonMetadata = {
      artist: uploader,
      album: title,
      album_artist: uploader,
      date: uploadDate,
      genre: options.genre,
      compilation: '1',
      gapless_playback: '1',
      comment: comment,
    };

    // Create each track
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const trackNum = i + 1;
      const trackFilename = generateTrackFilename(trackNum, segments.length, segment.title);
      const trackPath = join(albumPath, trackFilename);

      info(`Creating track ${trackNum}/${segments.length}: ${segment.title}`);

      await createTrack(
        audioFile,
        segment.startTime,
        segment.endTime,
        trackPath,
        {
          ...commonMetadata,
          title: segment.title,
          track: `${trackNum}/${segments.length}`,
        },
        artworkPath
      );

      success(`Track ${trackNum} created`);
    }

    success(`Album saved: ${albumPath}`);

    // Cleanup (only on success)
    if (!options.keepTemp) {
      info('Cleaning up temporary files...');
      rmSync(tempDir, { recursive: true, force: true });
      success('Cleanup complete');
    } else {
      info(`Temp files kept in: ${tempDir}`);
    }

    log('');
    success('Download and processing complete!');
    log(`Album: ${colors.green}${albumPath}${colors.reset}`);
    log(`Tracks: ${segments.length}`);

  } catch (e) {
    error(`Processing failed: ${e.message}`);
    log('');
    log(`Temp files preserved in: ${colors.yellow}${tempDir}${colors.reset}`);
    log('Run with the same URL again to resume from cache.');
    throw e;
  }
}

// Cleanup old temp directories
function cleanupTempDirs() {
  const tempBaseDir = join(process.cwd(), 'temp');

  if (!existsSync(tempBaseDir)) {
    log('No temp directory found - nothing to clean up.');
    return;
  }

  const dirs = readdirSync(tempBaseDir);

  if (dirs.length === 0) {
    log('No temp directories to clean up.');
    return;
  }

  log(`Found ${dirs.length} temp director${dirs.length === 1 ? 'y' : 'ies'}:`);
  dirs.forEach(dir => {
    const dirPath = join(tempBaseDir, dir);
    const files = readdirSync(dirPath);
    log(`  ${dir}/ (${files.length} file${files.length === 1 ? '' : 's'})`);
  });

  log('');
  log('Cleaning up...');

  dirs.forEach(dir => {
    const dirPath = join(tempBaseDir, dir);
    rmSync(dirPath, { recursive: true, force: true });
  });

  rmSync(tempBaseDir, { recursive: true, force: true });
  success('All temp directories cleaned up!');
}

// Prompt user for input
function promptUser(question, defaultValue = '') {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = defaultValue
      ? `${question} [${defaultValue}]: `
      : `${question}: `;

    readline.question(prompt, (answer) => {
      readline.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);

  // Handle cleanup command
  if (args.length > 0 && args[0] === '--cleanup') {
    log('YouTube Audio Downloader - Cleanup');
    log('===================================\n');
    cleanupTempDirs();
    return;
  }

  if (args.length === 0) {
    log('YouTube Audio Downloader (experiment.red)');
    log('');
    log('Usage:');
    log('  node experiment.red.js <YouTube URL> [options]');
    log('  bun experiment.red.js <YouTube URL> [options]');
    log('');
    log('Options:');
    log('  --force-redownload    Force re-download even if cached files exist');
    log('  --keep-temp           Keep temporary files after successful completion');
    log('  --genre <genre>       Set the genre metadata (default: "Dance & DJ")');
    log('  --cleanup             Remove all cached temporary directories');
    log('');
    log('Configuration:');
    log('  Create a .env file (see .env.example) to customize settings');
    log('');
    log(`Current settings:`);
    log(`  Output directory: ${CONFIG.musicDir}`);
    log(`  Browser for cookies: ${CONFIG.browser}`);
    log(`  Artwork size: ${CONFIG.artworkSize}x${CONFIG.artworkSize}`);
    log(`  Audio quality: ${CONFIG.audioQuality} (0=best, 10=worst)`);
    log('');
    log('Caching:');
    log('  Downloaded files are cached in temp/{video_id}/ directories');
    log('  If a download fails, run the same command again to resume from cache');
    log('  Temp files are automatically cleaned up after successful completion');
    log('  Use --cleanup to manually remove all cached files');
    process.exit(0);
  }

  // Parse URL and options
  let url = null;
  const options = {
    forceRedownload: false,
    keepTemp: false,
    genre: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--force-redownload') {
      options.forceRedownload = true;
    } else if (arg === '--keep-temp') {
      options.keepTemp = true;
    } else if (arg === '--genre') {
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        options.genre = args[i + 1];
        i++; // Skip next arg since we consumed it
      } else {
        error('--genre requires a value');
        process.exit(1);
      }
    } else if (!arg.startsWith('--')) {
      url = arg;
    } else {
      error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  if (!url) {
    error('No URL provided');
    process.exit(1);
  }

  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
    error('URL must be a YouTube URL');
    process.exit(1);
  }

  log('YouTube Audio Downloader');
  log('=======================\n');

  checkDependencies();
  await downloadAndProcess(url, options);
}

main().catch(e => {
  error(e.message);
  process.exit(1);
});
