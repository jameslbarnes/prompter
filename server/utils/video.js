const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const fetch = require('node-fetch');

// Helper function to get a cross-platform font
function getSystemFont() {
    const platform = os.platform();
    const fonts = {
        'darwin': '/System/Library/Fonts/Helvetica.ttc',
        'win32': 'C:\\Windows\\Fonts\\arial.ttf',
        'linux': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    };
    
    // Try common font paths
    const fallbackFonts = [
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
        'C:\\Windows\\Fonts\\arial.ttf'
    ];
    
    // Check if platform-specific font exists
    if (fonts[platform] && fs.existsSync(fonts[platform])) {
        return fonts[platform];
    }
    
    // Try fallback fonts
    for (const font of fallbackFonts) {
        if (fs.existsSync(font)) {
            return font;
        }
    }
    
    // If no font found, return empty (FFmpeg will use default)
    console.warn('[getSystemFont] No system font found, using FFmpeg default');
    return '';
}

// Create a video with text overlay for TTS segments
async function createTextOverlayVideo(text, audioPath, outputPath, videoFormat = null, brollPrompt = null) {
    return new Promise(async (resolve, reject) => {
        console.log('[createTextOverlayVideo] Creating video with text overlay');
        console.log('[createTextOverlayVideo] Audio path:', audioPath);
        console.log('[createTextOverlayVideo] Output path:', outputPath);
        
        // Check if audio file exists
        if (!fs.existsSync(audioPath)) {
            console.error('[createTextOverlayVideo] Audio file does not exist:', audioPath);
            return reject(new Error(`Audio file not found: ${audioPath}`));
        }
        
        // Check if output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            console.error('[createTextOverlayVideo] Output directory does not exist:', outputDir);
            console.log('[createTextOverlayVideo] Creating output directory...');
            try {
                fs.mkdirSync(outputDir, { recursive: true });
            } catch (e) {
                console.error('[createTextOverlayVideo] Failed to create output directory:', e);
                return reject(new Error(`Failed to create output directory: ${outputDir}`));
            }
        }
        
        // Default format if none provided - match common user video format
        const format = videoFormat || {
            width: 1920,
            height: 1080,
            pixFmt: 'yuv420p',
            fps: 30,
            codec: 'libvpx-vp9'  // Default to VP9 to match user videos
        };
        
        console.log('[createTextOverlayVideo] Using format:', format);
        console.log('[createTextOverlayVideo] B-roll prompt:', brollPrompt);
        
        // Build the filter complex for video generation
        // Ensure dimensions are even numbers (required for many codecs)
        const width = format.width ? (Math.floor(format.width / 2) * 2) : 1920;
        const height = format.height ? (Math.floor(format.height / 2) * 2) : 1080;
        
        // Try multiple paths for the font file
        const fontPaths = [
            path.join(__dirname, '..', '..', 'fonts', 'Roboto-Regular.ttf'),
            path.join(process.cwd(), 'fonts', 'Roboto-Regular.ttf'),
            path.join('/app', 'fonts', 'Roboto-Regular.ttf'),
            './fonts/Roboto-Regular.ttf'
        ];
        
        console.log('[createTextOverlayVideo] Looking for font file...');
        
        let fontPath = null;
        let useSystemFont = false;
        
        for (const fp of fontPaths) {
            if (fs.existsSync(fp)) {
                fontPath = fp;
                const stats = fs.statSync(fp);
                console.log(`[createTextOverlayVideo] Font found at: ${fp} (${stats.size} bytes)`);
                break;
            }
        }
        
        if (!fontPath) {
            console.error('[createTextOverlayVideo] Font file not found in any of these locations:', fontPaths);
            console.log('[createTextOverlayVideo] Will use system font fallback');
            useSystemFont = true;
        }
        
        // Build filter complex for video generation
        let filterComplex = `color=c=0x333333:s=${width}x${height}[bg]`;
        
        // Add b-roll prompt if provided
        if (brollPrompt) {
            console.log(`[createTextOverlayVideo] B-roll prompt received:`, JSON.stringify(brollPrompt, null, 2));
            
            let prompts = [];
            
            // Check if brollPrompt is an array or a string
            if (Array.isArray(brollPrompt)) {
                prompts = brollPrompt.map(p => String(p || ''));
            } else if (typeof brollPrompt === 'string') {
                // Try to parse if it's a JSON string
                try {
                    const parsed = JSON.parse(brollPrompt);
                    if (Array.isArray(parsed)) {
                        prompts = parsed.map(p => String(p || ''));
                    } else {
                        // Single prompt as string
                        prompts = [String(brollPrompt)];
                    }
                } catch (e) {
                    // Not JSON, use as-is
                    prompts = [String(brollPrompt)];
                }
            } else {
                // Unexpected type, convert to string
                console.warn(`[createTextOverlayVideo] Unexpected brollPrompt type: ${typeof brollPrompt}`);
                prompts = [String(brollPrompt || '')];
            }
            
            // Sanitize prompts - remove special characters that break FFmpeg
            const sanitizedPrompts = prompts.map(prompt => {
                let cleaned = prompt
                    .replace(/'/g, '') // Remove apostrophes that can break FFmpeg filter syntax
                    .replace(/:/g, '') // Remove colons that can break FFmpeg syntax
                    .replace(/[^\w\s.,!?-]/g, ''); // Remove all other special chars except basic punctuation
                
                // Truncate to 70 chars but don't cut words
                if (cleaned.length > 70) {
                    cleaned = cleaned.substring(0, 70);
                    // Find last space to avoid cutting words
                    const lastSpace = cleaned.lastIndexOf(' ');
                    if (lastSpace > 50) {
                        cleaned = cleaned.substring(0, lastSpace);
                    }
                }
                return cleaned.trim();
            });
            
            console.log(`[createTextOverlayVideo] ${sanitizedPrompts.length} sanitized prompts`);
            sanitizedPrompts.forEach((prompt, i) => {
                console.log(`[createTextOverlayVideo] Prompt ${i + 1}: "${prompt}"`);
            });
            
            // ALWAYS use the Roboto font file directly - no bullshit
            const fontParam = `fontfile=/app/fonts/Roboto-Regular.ttf:`;
            
            // Get audio duration to calculate proper timestamps
            const audioDuration = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(audioPath, (err, metadata) => {
                    if (err) {
                        console.error('[createTextOverlayVideo] Error probing audio:', err);
                        resolve(8); // Default duration
                    } else {
                        resolve(metadata.format.duration || 8);
                    }
                });
            });
            
            console.log(`[createTextOverlayVideo] Audio duration: ${audioDuration} seconds`);
            console.log(`[createTextOverlayVideo] Number of prompts: ${sanitizedPrompts.length}`);
            
            // Display all prompts
            const fontSize = sanitizedPrompts.length > 4 ? 36 : sanitizedPrompts.length > 2 ? 42 : 48;
            const lineHeight = fontSize + 15;
            const startY = Math.max(100, height / 2 - (sanitizedPrompts.length * lineHeight) / 2 - 100);
            
            // Calculate total b-roll segments
            const totalBrollSegments = sanitizedPrompts.length;
            const segmentDuration = Math.ceil(audioDuration);
            
            // Function to escape text for FFmpeg filter
            const escapeFilterText = (text) => {
                // Escape special characters for FFmpeg filter syntax
                return text
                    .replace(/\\/g, '\\\\')  // Escape backslashes first
                    .replace(/'/g, "\\'")    // Escape single quotes
                    .replace(/:/g, '\\:')    // Escape colons
                    .replace(/,/g, '\\,')    // Escape commas
                    .replace(/\[/g, '\\[')   // Escape square brackets
                    .replace(/\]/g, '\\]')   // Escape square brackets
                    .replace(/;/g, '\\;');   // Escape semicolons
            };
            
            // Add title text
            const titleText = `B-ROLL SEQUENCE - ${totalBrollSegments} visual${totalBrollSegments > 1 ? 's' : ''} for ${segmentDuration}s narration`;
            filterComplex += `;[bg]drawtext=${fontParam}text='${escapeFilterText(titleText)}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=${startY}:box=1:boxcolor=black@0.8:boxborderw=20`;
            
            // Add each prompt
            sanitizedPrompts.forEach((prompt, index) => {
                const y = startY + 80 + (index * lineHeight);
                
                // Truncate prompt if needed for display
                let displayPrompt = prompt;
                if (displayPrompt.length > 80) {
                    displayPrompt = displayPrompt.substring(0, 77) + '...';
                }
                
                const promptText = `B-Roll ${index + 1}: ${displayPrompt}`;
                filterComplex += `,drawtext=${fontParam}text='${escapeFilterText(promptText)}':fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=${y}:box=1:boxcolor=black@0.8:boxborderw=10`;
            });
            
            filterComplex += `[v]`;
        } else {
            filterComplex += '[v]';
        }
        
        // Map codec names from probe to FFmpeg encoder names
        let videoCodec = 'libx264'; // default
        if (format.codec) {
            if (format.codec === 'vp9' || format.codec === 'libvpx-vp9') {
                videoCodec = 'libvpx-vp9';
            } else if (format.codec === 'h264' || format.codec === 'libx264') {
                videoCodec = 'libx264';
            } else {
                videoCodec = format.codec;
            }
        }
        
        // Log the complete filter for debugging
        console.log(`[createTextOverlayVideo] Complete filter complex:`, filterComplex);
        
        // Create FFmpeg command
        const ffmpegCommand = ffmpeg()
            .input(audioPath)
            .complexFilter(filterComplex)
            .outputOptions([
                '-map', '[v]',
                '-map', '0:a',
                '-c:v', videoCodec,
                '-b:v', '2M',           // Video bitrate for VP9
                '-c:a', 'aac',          // Always use AAC for audio
                '-ar', '44100',         // Match common sample rate from user videos
                '-ac', '2',             // Stereo audio to match user videos
                '-b:a', '128k',         // Audio bitrate
                '-shortest',
                '-pix_fmt', format.pixFmt || 'yuv420p',
                '-r', format.fps || 30
            ])
            .on('start', (commandLine) => {
                console.log('[createTextOverlayVideo] FFmpeg command:', commandLine);
            })
            .on('stderr', (stderrLine) => {
                console.log('[createTextOverlayVideo] FFmpeg:', stderrLine);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`[createTextOverlayVideo] Progress: ${progress.percent.toFixed(1)}%`);
                }
            })
            .on('error', (err, stdout, stderr) => {
                console.error('[createTextOverlayVideo] Error:', err);
                console.error('[createTextOverlayVideo] FFmpeg stderr:', stderr);
                reject(err);
            })
            .on('end', () => {
                console.log('[createTextOverlayVideo] Video created successfully');
                resolve();
            })
            .save(outputPath);
    });
}

// Create a video visualization for audio-only content
async function createAudioVisualizationVideo(audioPath, outputPath, title, videoFormat = null) {
    return new Promise((resolve, reject) => {
        console.log('[createAudioVisualizationVideo] Creating simple video for audio-only content');
        
        // Default format if none provided
        const format = videoFormat || {
            width: 1280,
            height: 720,
            pixFmt: 'yuv420p',
            fps: 30
        };
        
        console.log('[createAudioVisualizationVideo] Using format:', format);
        
        // Simple dark gray video with audio - match reference video format
        ffmpeg()
            .input(audioPath)
            .input(`color=c=0x333333:s=${format.width}x${format.height}`)  // Dark gray background
            .inputOptions(['-f', 'lavfi'])
            .outputOptions([
                '-map', '1:v',
                '-map', '0:a',
                '-c:v', 'libx264',
                '-preset', 'veryfast',   
                '-crf', '23',            
                '-pix_fmt', format.pixFmt,   
                '-r', format.fps,              
                '-c:a', 'aac',          // Encode audio to AAC to match video clips
                '-ar', '48000',         // Match sample rate of video clips
                '-ac', '1',             // Mono audio
                '-b:a', '128k',         // Audio bitrate
                '-shortest'
            ])
            .on('error', (err) => {
                console.error('[createAudioVisualizationVideo] Error:', err);
                reject(err);
            })
            .on('end', () => {
                console.log('[createAudioVisualizationVideo] Video created successfully');
                resolve();
            })
            .save(outputPath);
    });
}

async function extractAudioSegment(inputPath, outputPath, startTime, endTime) {
    return new Promise((resolve, reject) => {
        const duration = endTime - startTime;
        if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || duration <= 0) {
            return reject(new Error(`Invalid audio segment timecode: ${startTime}-${endTime}`));
        }

        const command = ffmpeg(inputPath)
            .setStartTime(startTime)
            .setDuration(duration)
            .outputOptions([
                '-vn',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-ar', '44100',
                '-ac', '2'
            ])
            .on('error', reject)
            .on('end', resolve);

        const timeout = setTimeout(() => {
            command.kill('SIGKILL');
            reject(new Error('Audio extraction timed out after 60 seconds'));
        }, 60000);

        command
            .on('end', () => clearTimeout(timeout))
            .on('error', () => clearTimeout(timeout))
            .save(outputPath);
    });
}

// Helper function to handle audio-only clips
async function handleAudioOnlyClip(mediaData, tempDir, baseFileName, videoFilePaths, videoFormat = null) {
    const audioUrl = mediaData.audioUrl || mediaData.url;
    if (!audioUrl) {
        console.warn(`[handleAudioOnlyClip] Skipping audio-only clip ${mediaData.responseId || baseFileName}: no audio URL available`);
        return;
    }

    const rawAudioPath = path.join(tempDir, `${baseFileName}_audio_raw.mp3`);

    try {
        console.log(`[handleAudioOnlyClip] Downloading audio from: ${audioUrl}`);
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        try {
            const response = await fetch(audioUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Say-Platform/1.0)'
                }
            });
            clearTimeout(timeout);
            
            if (!response.ok) throw new Error(`Failed to download audio: ${response.statusText}`);
            
            const audioBuffer = await response.buffer();
            await fs.promises.writeFile(rawAudioPath, audioBuffer);
        } catch (fetchError) {
            clearTimeout(timeout);
            if (fetchError.name === 'AbortError') {
                throw new Error('Audio download timed out after 30 seconds');
            }
            throw fetchError;
        }
        
        let matchedTimecodes = null;
        if (mediaData.word_timestamps && mediaData.word_timestamps.length > 0 && mediaData.quote) {
            const cleanedTranscriptWords = mediaData.word_timestamps.map(wt => ({
                text: wt.word.replace(/[^a-zA-Z0-9']/g, "").toLowerCase(),
                start: wt.start,
                end: wt.end
            }));

            try {
                matchedTimecodes = findBestSubsegment(cleanedTranscriptWords, mediaData.quote);
            } catch (matchError) {
                console.warn(`[handleAudioOnlyClip] Failed to match quote for ${mediaData.responseId || baseFileName}:`, matchError.message);
            }
        }

        if (matchedTimecodes && matchedTimecodes.length > 0) {
            const initialCount = videoFilePaths.length;
            console.log(`[handleAudioOnlyClip] Found ${matchedTimecodes.length} matching audio segment(s) for ${mediaData.responseId || baseFileName}`);

            for (let i = 0; i < matchedTimecodes.length; i++) {
                const timecode = matchedTimecodes[i];
                const partAudioPath = path.join(tempDir, `${baseFileName}_audio_part_${i}.m4a`);
                const partVideoPath = path.join(tempDir, `${baseFileName}_audio_video_part_${i}.mp4`);

                try {
                    await extractAudioSegment(rawAudioPath, partAudioPath, timecode.start, timecode.end);
                    await createAudioVisualizationVideo(partAudioPath, partVideoPath, mediaData.quote || "User Response", videoFormat);
                    videoFilePaths.push(partVideoPath);
                    console.log(`[handleAudioOnlyClip] Trimmed audio visualization video created: ${partVideoPath}`);
                } catch (partError) {
                    console.warn(`[handleAudioOnlyClip] Failed to create trimmed audio part ${i} for ${mediaData.responseId || baseFileName}:`, partError.message);
                }
            }

            if (videoFilePaths.length > initialCount) {
                return;
            }
        }

        const fallbackDuration = estimateDurationFromQuote(mediaData.quote);
        if (fallbackDuration) {
            const boundedAudioPath = path.join(tempDir, `${baseFileName}_audio_bounded.m4a`);
            const boundedVideoPath = path.join(tempDir, `${baseFileName}_audio_video_bounded.mp4`);

            try {
                console.warn(`[handleAudioOnlyClip] No quote timestamp match for ${mediaData.responseId || baseFileName}; using bounded ${fallbackDuration.toFixed(2)}s audio fallback`);
                await extractAudioSegment(rawAudioPath, boundedAudioPath, 0, fallbackDuration);
                await createAudioVisualizationVideo(boundedAudioPath, boundedVideoPath, mediaData.quote || "User Response", videoFormat);
                videoFilePaths.push(boundedVideoPath);
                return;
            } catch (fallbackError) {
                console.warn(`[handleAudioOnlyClip] Bounded audio fallback failed for ${mediaData.responseId || baseFileName}:`, fallbackError.message);
            }
        }

        console.warn(`[handleAudioOnlyClip] No quote timestamp match for ${mediaData.responseId || baseFileName}; using full audio clip`);
        const videoPath = path.join(tempDir, `${baseFileName}_audio_video.mp4`);
        await createAudioVisualizationVideo(rawAudioPath, videoPath, mediaData.quote || "User Response", videoFormat);

        videoFilePaths.push(videoPath);
        console.log(`[handleAudioOnlyClip] Audio visualization video created: ${videoPath}`);
    } catch (error) {
        console.error(`[handleAudioOnlyClip] Error processing audio clip:`, error);
    }
}

// Extract a segment from a video file
async function extractVideoSegment(inputPath, outputPath, startTime, endTime) {
    return new Promise((resolve, reject) => {
        console.log(`[extractVideoSegment] Extracting segment from ${startTime}s to ${endTime}s (duration: ${endTime - startTime}s)`);
        console.log(`[extractVideoSegment] Input: ${inputPath}`);
        console.log(`[extractVideoSegment] Output: ${outputPath}`);
        
        const command = ffmpeg(inputPath)
            .setStartTime(startTime)
            .setDuration(endTime - startTime)
            .outputOptions([
                '-c', 'copy',             // Copy streams without re-encoding (MUCH faster)
                '-avoid_negative_ts', 'make_zero'
            ])
            .on('start', (commandLine) => {
                console.log('[extractVideoSegment] Spawned ffmpeg with command:', commandLine);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`[extractVideoSegment] Progress: ${progress.percent.toFixed(1)}%`);
                }
            })
            .on('error', (err) => {
                console.error('[extractVideoSegment] Error:', err);
                reject(err);
            })
            .on('end', () => {
                console.log('[extractVideoSegment] Segment extracted successfully');
                resolve();
            });
            
        // Add a timeout to prevent hanging
        const timeout = setTimeout(() => {
            console.error('[extractVideoSegment] Timeout after 60 seconds, killing ffmpeg process');
            command.kill('SIGKILL');
            reject(new Error('Video extraction timed out after 60 seconds'));
        }, 60000); // 60 second timeout
        
        command.on('end', () => {
            clearTimeout(timeout);
            resolve();
        }).on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
        
        command.save(outputPath);
    });
}

// Convert video to MP4 format
async function convertVideoToMP4(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log(`[convertVideoToMP4] Converting video to MP4 format`);
        console.log(`[convertVideoToMP4] Input: ${inputPath}`);
        console.log(`[convertVideoToMP4] Output: ${outputPath}`);
        
        // Try to copy streams without re-encoding
        const command = ffmpeg(inputPath)
            .outputOptions([
                '-c', 'copy',            // Try to copy streams without re-encoding
                '-movflags', '+faststart' // Still optimize for streaming
            ])
            .on('start', (commandLine) => {
                console.log('[convertVideoToMP4] Spawned ffmpeg with command:', commandLine);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`[convertVideoToMP4] Progress: ${progress.percent.toFixed(1)}%`);
                }
            })
            .on('error', (err) => {
                console.error('[convertVideoToMP4] Error:', err);
                reject(err);
            })
            .on('end', () => {
                console.log('[convertVideoToMP4] Conversion completed');
                resolve();
            });
            
        // Add a timeout
        const timeout = setTimeout(() => {
            console.error('[convertVideoToMP4] Timeout after 60 seconds, killing ffmpeg process');
            command.kill('SIGKILL');
            reject(new Error('Video conversion timed out after 60 seconds'));
        }, 60000);
        
        command.on('end', () => {
            clearTimeout(timeout);
            resolve();
        }).on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
        
        command.save(outputPath);
    });
}

// Get video metadata using ffprobe
async function getVideoMetadata(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
                // Calculate FPS properly
                let fps = 30; // Default
                if (videoStream && videoStream.r_frame_rate) {
                    const fpsMatch = videoStream.r_frame_rate.match(/(\d+)\/(\d+)/);
                    if (fpsMatch) {
                        fps = Math.round(parseInt(fpsMatch[1]) / parseInt(fpsMatch[2]));
                    } else {
                        fps = parseInt(videoStream.r_frame_rate) || 30;
                    }
                    // Sanity check - common frame rates
                    if (fps > 60 || fps < 15) {
                        console.warn(`[getVideoMetadata] Unusual fps detected: ${fps}, using 30`);
                        fps = 30;
                    }
                }
                
                resolve({
                    video: videoStream ? {
                        codec: videoStream.codec_name,
                        width: videoStream.width,
                        height: videoStream.height,
                        pixFmt: videoStream.pix_fmt,
                        fps: fps
                    } : null,
                    audio: audioStream ? {
                        codec: audioStream.codec_name,
                        sampleRate: audioStream.sample_rate,
                        channels: audioStream.channels
                    } : null,
                    duration: metadata.format.duration
                });
            }
        });
    });
}

// Generate a thumbnail from video at a specific time
async function generateVideoThumbnail(videoPath, thumbnailPath, seekTime = 2) {
    return new Promise((resolve, reject) => {
        console.log(`[generateVideoThumbnail] Creating thumbnail from ${videoPath} at ${seekTime}s`);
        
        ffmpeg(videoPath)
            .seekInput(seekTime) // Seek to specific time (default 2 seconds in)
            .frames(1) // Extract just one frame
            .outputOptions([
                '-vf', 'scale=640:-1', // Scale to 640px width, maintain aspect ratio
                '-q:v', '2' // High quality JPEG
            ])
            .on('start', (commandLine) => {
                console.log('[generateVideoThumbnail] FFmpeg command:', commandLine);
            })
            .on('error', (err) => {
                console.error('[generateVideoThumbnail] Error:', err);
                reject(err);
            })
            .on('end', () => {
                console.log('[generateVideoThumbnail] Thumbnail created successfully');
                resolve();
            })
            .save(thumbnailPath);
    });
}

function shouldLogFfmpegLine(line) {
    if (!line) return false;
    return /error|failed|invalid|resource|unable|no such|not found|timeout|warning/i.test(line);
}

function ffmpegSafePath(filePath) {
    return String(filePath).replace(/'/g, "'\\''");
}

async function normalizeVideoForConcat(inputPath, outputPath, metadata, index, total) {
    return new Promise((resolve, reject) => {
        const targetWidth = parseInt(process.env.REPORT_VIDEO_STITCH_WIDTH, 10) || 1920;
        const targetHeight = parseInt(process.env.REPORT_VIDEO_STITCH_HEIGHT, 10) || 1080;
        const hasAudio = !!metadata?.audio;
        const timeoutMs = parseInt(process.env.REPORT_VIDEO_NORMALIZE_TIMEOUT_MS, 10) || 180000;

        console.log(`[stitchVideoFiles] Normalizing ${index + 1}/${total}: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`);

        const command = ffmpeg(inputPath);
        const videoFilter = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p`;

        if (!hasAudio) {
            command.complexFilter(`[0:v]${videoFilter}[v];anullsrc=channel_layout=stereo:sample_rate=44100[a]`);
        }

        const outputOptions = [
            ...(hasAudio ? ['-map', '0:v:0', '-map', '0:a:0', '-vf', videoFilter] : ['-map', '[v]', '-map', '[a]']),
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-ar', '44100',
            '-ac', '2',
            '-r', '30',
            '-threads', '1',
            '-shortest',
            '-movflags', '+faststart'
        ];

        const timeout = setTimeout(() => {
            console.error(`[stitchVideoFiles] Normalization timeout for ${path.basename(inputPath)} after ${timeoutMs}ms`);
            command.kill('SIGKILL');
            reject(new Error(`Video normalization timed out: ${path.basename(inputPath)}`));
        }, timeoutMs);

        command
            .outputOptions(outputOptions)
            .on('start', () => {
                console.log(`[stitchVideoFiles] FFmpeg normalize started for ${index + 1}/${total}`);
            })
            .on('stderr', (line) => {
                if (shouldLogFfmpegLine(line)) {
                    console.warn(`[stitchVideoFiles] FFmpeg normalize: ${line}`);
                }
            })
            .on('end', () => {
                clearTimeout(timeout);
                resolve(outputPath);
            })
            .on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            })
            .save(outputPath);
    });
}

async function concatNormalizedVideos(normalizedPaths, listPath, outputPath) {
    await fs.promises.writeFile(
        listPath,
        normalizedPaths.map(filePath => `file '${ffmpegSafePath(path.resolve(filePath))}'`).join('\n') + '\n',
        'utf8'
    );

    return new Promise((resolve, reject) => {
        const timeoutMs = parseInt(process.env.REPORT_VIDEO_CONCAT_TIMEOUT_MS, 10) || 600000;
        const command = ffmpeg()
            .input(listPath)
            .inputOptions(['-f', 'concat', '-safe', '0'])
            .outputOptions([
                '-c', 'copy',
                '-movflags', '+faststart'
            ]);

        const timeout = setTimeout(() => {
            console.error(`[stitchVideoFiles] Concat timeout after ${timeoutMs}ms`);
            command.kill('SIGKILL');
            reject(new Error('Video concat timed out'));
        }, timeoutMs);

        command
            .on('start', () => {
                console.log(`[stitchVideoFiles] Concatenating ${normalizedPaths.length} normalized files`);
            })
            .on('stderr', (line) => {
                if (shouldLogFfmpegLine(line)) {
                    console.warn(`[stitchVideoFiles] FFmpeg concat: ${line}`);
                }
            })
            .on('end', () => {
                clearTimeout(timeout);
                resolve();
            })
            .on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            })
            .save(outputPath);
    });
}

// Stitch multiple video files together
async function stitchVideoFiles(videoFilePaths, outputPath) {
    if (videoFilePaths.length === 0) {
        throw new Error('No video files to stitch');
    }

    console.log(`[stitchVideoFiles] Preparing to stitch ${videoFilePaths.length} video files`);

    const outputDir = path.dirname(outputPath);
    const normalizedDir = await fs.promises.mkdtemp(path.join(outputDir, 'normalized-segments-'));
    const listPath = path.join(normalizedDir, 'concat-list.txt');
    const normalizedPaths = [];

    try {
        const metadataByPath = [];
        for (let i = 0; i < videoFilePaths.length; i++) {
            const metadata = await getVideoMetadata(videoFilePaths[i]);
            metadataByPath.push(metadata);
            console.log(`[stitchVideoFiles] Video ${i + 1}/${videoFilePaths.length}: ${path.basename(videoFilePaths[i])}`, {
                video: metadata.video,
                audio: metadata.audio,
                duration: metadata.duration
            });
        }

        for (let i = 0; i < videoFilePaths.length; i++) {
            const normalizedPath = path.join(normalizedDir, `segment_${String(i).padStart(4, '0')}.mp4`);
            await normalizeVideoForConcat(videoFilePaths[i], normalizedPath, metadataByPath[i], i, videoFilePaths.length);
            normalizedPaths.push(normalizedPath);
        }

        await concatNormalizedVideos(normalizedPaths, listPath, outputPath);
        console.log('[stitchVideoFiles] Video stitching completed successfully');
    } catch (error) {
        console.error('[stitchVideoFiles] Error during video stitching:', error);
        throw error;
    } finally {
        await fs.promises.rm(normalizedDir, { recursive: true, force: true }).catch((cleanupError) => {
            console.warn('[stitchVideoFiles] Failed to clean normalized segments:', cleanupError.message);
        });
    }
}

// Helper function for Levenshtein distance calculation
function levenshteinDistance(s1, s2) {
    if (!s1) return s2 ? s2.length : 0;
    if (!s2) return s1.length;

    const matrix = [];

    for (let i = 0; i <= s2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
        for (let j = 1; j <= s1.length; j++) {
            const cost = s1[j - 1] === s2[i - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // Deletion
                matrix[i][j - 1] + 1,      // Insertion
                matrix[i - 1][j - 1] + cost // Substitution
            );
        }
    }

    return matrix[s2.length][s1.length];
}

function wordsApproximatelyMatch(transcriptWord, quoteWord) {
    const distance = levenshteinDistance(transcriptWord, quoteWord);
    const maxLength = Math.max(transcriptWord.length, quoteWord.length);

    const transcriptIsNum = /^\d+$/.test(transcriptWord);
    const quoteIsNum = /^\d+$/.test(quoteWord);
    const transcriptIsAlpha = /^[a-z']+$/.test(transcriptWord);
    const quoteIsAlpha = /^[a-z']+$/.test(quoteWord);

    let threshold;
    if (maxLength <= 3 && ((transcriptIsNum && quoteIsAlpha) || (transcriptIsAlpha && quoteIsNum))) {
        threshold = maxLength;
    } else if (maxLength <= 1) {
        threshold = 0;
    } else if (maxLength <= 4) {
        threshold = 1;
    } else {
        threshold = Math.floor(maxLength * 0.33);
    }

    return distance <= threshold;
}

function findAnchorMatch(cleanedTranscriptWords, anchorWords, startIndex) {
    const requiredMatches = Math.max(2, Math.ceil(anchorWords.length * 0.65));
    const scanAllowance = Math.max(4, Math.ceil(anchorWords.length * 0.8));
    let bestMatch = null;

    for (let i = startIndex; i < cleanedTranscriptWords.length; i++) {
        let anchorIndex = 0;
        let matchedWordCount = 0;
        let startTime = -1;
        let endTime = -1;
        let endIdx = i - 1;
        const scanLimit = Math.min(cleanedTranscriptWords.length, i + anchorWords.length + scanAllowance);

        for (let k = i; k < scanLimit && anchorIndex < anchorWords.length; k++) {
            if (wordsApproximatelyMatch(cleanedTranscriptWords[k].text, anchorWords[anchorIndex])) {
                if (startTime === -1) {
                    startTime = cleanedTranscriptWords[k].start;
                }
                endTime = cleanedTranscriptWords[k].end;
                endIdx = k;
                anchorIndex++;
                matchedWordCount++;
            }
        }

        if (!bestMatch || matchedWordCount > bestMatch.matchedWordCount) {
            bestMatch = { start: startTime, end: endTime, transcriptEndIdx: endIdx, matchedWordCount };
        }

        if (matchedWordCount === anchorWords.length) {
            break;
        }
    }

    return bestMatch && bestMatch.matchedWordCount >= requiredMatches ? bestMatch : null;
}

function findAnchoredSubsegment(cleanedTranscriptWords, quotePartWords, startIndex) {
    if (quotePartWords.length < 12) {
        return null;
    }

    const anchorLength = Math.min(12, Math.max(4, Math.ceil(quotePartWords.length * 0.08)));
    const startAnchor = quotePartWords.slice(0, anchorLength);
    const endAnchor = quotePartWords.slice(-anchorLength);

    const startMatch = findAnchorMatch(cleanedTranscriptWords, startAnchor, startIndex);
    if (!startMatch) {
        return null;
    }

    const endMatch = findAnchorMatch(cleanedTranscriptWords, endAnchor, startMatch.transcriptEndIdx + 1);
    if (!endMatch || endMatch.end <= startMatch.start) {
        return null;
    }

    return {
        start: startMatch.start,
        end: endMatch.end,
        transcriptEndIdx: endMatch.transcriptEndIdx,
        matchedWordCount: startMatch.matchedWordCount + endMatch.matchedWordCount
    };
}

function estimateDurationFromQuote(quoteText) {
    if (!quoteText || typeof quoteText !== 'string') {
        return null;
    }

    const wordCount = quoteText
        .replace(/<[^>]*>/g, ' ')
        .replace(/[^a-zA-Z0-9'\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;

    if (wordCount === 0) {
        return null;
    }

    const wordsPerSecond = parseFloat(process.env.REPORT_VIDEO_FALLBACK_WORDS_PER_SECOND) || 2.35;
    const paddingSeconds = parseFloat(process.env.REPORT_VIDEO_FALLBACK_PADDING_SECONDS) || 2;
    const maxSeconds = parseFloat(process.env.REPORT_VIDEO_FALLBACK_MAX_SECONDS) || 900;
    return Math.min(maxSeconds, Math.max(4, (wordCount / wordsPerSecond) + paddingSeconds));
}

// Find best subsegment matching for audio clips
function findBestSubsegment(transcriptWords, quoteText) {
    if (!quoteText || quoteText.trim() === '' || !transcriptWords || transcriptWords.length === 0) {
        return null;
    }

    // Clean transcript words once
    const cleanedTranscriptWords = transcriptWords.map(tw => ({
        ...tw,
        text: tw.text.replace(/[^a-zA-Z0-9']/g, "").toLowerCase()
    }));

    const standardizedEllipsis = ' __ELLIPSIS_DELIMITER__ '; 
    const partsStrings = quoteText.replace(/(\.\.\s*){3,}/g, standardizedEllipsis) 
                                .split(standardizedEllipsis)
                                .map(part => part.trim())
                                .filter(part => part !== '');

    if (partsStrings.length === 0) {
        console.warn('[findBestSubsegment] No valid parts after splitting quote.');
        return null; 
    }

    let currentTranscriptIndex = 0; 
    const matchedPartsTimecodes = []; 

    const MIN_MATCH_PERCENTAGE = 0.4; 

    for (const partStr of partsStrings) {
        const quotePartWords = partStr
            .trim()
            .split(/\s+/)
            .map(word => word.replace(/[^a-zA-Z0-9']/g, "").toLowerCase())
            .filter(Boolean);

        if (quotePartWords.length === 0) {
            continue; 
        }

        let bestMatchForPart = null; 
        let highestMatchedWordCountForPart = 0;
        let currentBestMatchCountForThisOuterLoop = highestMatchedWordCountForPart;

        for (let i = currentTranscriptIndex; i < cleanedTranscriptWords.length; i++) {
            let currentQuoteWordIdx = 0;
            let transcriptWordsScanned = 0;
            let potentialPartStartTime = -1;
            let potentialPartEndTime = -1;
            let lastMatchedTranscriptIdx = i -1; 
            let currentMatchedWordCount = 0;

            for (let k = i; k < cleanedTranscriptWords.length && currentQuoteWordIdx < quotePartWords.length; k++) {
                transcriptWordsScanned++;
                
                const tw = cleanedTranscriptWords[k].text;
                const qw = quotePartWords[currentQuoteWordIdx];
                
                const isMatch = wordsApproximatelyMatch(tw, qw);

                if (isMatch) {
                    if (potentialPartStartTime === -1) {
                        potentialPartStartTime = cleanedTranscriptWords[k].start;
                    }
                    potentialPartEndTime = cleanedTranscriptWords[k].end;
                    lastMatchedTranscriptIdx = k;
                    currentQuoteWordIdx++;
                    currentMatchedWordCount++;
                }
                
                // Expanded window: allow transcript part to be longer by max(10 words, 30% of quote part length)
                const scanWindowAllowance = Math.max(10, Math.floor(quotePartWords.length * 0.30));
                if (transcriptWordsScanned > quotePartWords.length + scanWindowAllowance && currentQuoteWordIdx < quotePartWords.length) { 
                    break; 
                }
            }

            if (currentMatchedWordCount > highestMatchedWordCountForPart) {
                highestMatchedWordCountForPart = currentMatchedWordCount;
                bestMatchForPart = {
                    start: potentialPartStartTime,
                    end: potentialPartEndTime,
                    transcriptEndIdx: lastMatchedTranscriptIdx,
                    matchedWordCount: currentMatchedWordCount
                };
            }
            
            if (bestMatchForPart && bestMatchForPart.matchedWordCount > (currentBestMatchCountForThisOuterLoop || 0)) {
                currentBestMatchCountForThisOuterLoop = bestMatchForPart.matchedWordCount;
            }

            if (highestMatchedWordCountForPart === quotePartWords.length) {
                break;
            }
        }
        
        const requiredWordMatches = Math.ceil(quotePartWords.length * MIN_MATCH_PERCENTAGE);
        if (bestMatchForPart && bestMatchForPart.matchedWordCount >= requiredWordMatches && bestMatchForPart.matchedWordCount > 0) {
            const strongMatchThreshold = Math.ceil(quotePartWords.length * 0.75);
            const anchoredMatch = bestMatchForPart.matchedWordCount < strongMatchThreshold
                ? findAnchoredSubsegment(cleanedTranscriptWords, quotePartWords, currentTranscriptIndex)
                : null;

            if (anchoredMatch) {
                console.warn(`[findBestSubsegment] Used anchor fallback to extend long quote part: "${partStr.substring(0, 120)}..."`);
                matchedPartsTimecodes.push({ start: anchoredMatch.start, end: anchoredMatch.end });
                currentTranscriptIndex = anchoredMatch.transcriptEndIdx + 1;
            } else {
                matchedPartsTimecodes.push({ start: bestMatchForPart.start, end: bestMatchForPart.end });
                currentTranscriptIndex = bestMatchForPart.transcriptEndIdx + 1;
            }
        } else {
            const anchoredMatch = findAnchoredSubsegment(cleanedTranscriptWords, quotePartWords, currentTranscriptIndex);
            if (anchoredMatch) {
                console.warn(`[findBestSubsegment] Used anchor fallback for long quote part: "${partStr.substring(0, 120)}..."`);
                matchedPartsTimecodes.push({ start: anchoredMatch.start, end: anchoredMatch.end });
                currentTranscriptIndex = anchoredMatch.transcriptEndIdx + 1;
                continue;
            }

            const transcriptSnippet = cleanedTranscriptWords.slice(currentTranscriptIndex, currentTranscriptIndex + 15).map(t => t.text).join(' ');
            console.warn(`[findBestSubsegment] FAILURE - Failed to match part: "${partStr}" (Best: ${highestMatchedWordCountForPart}/${quotePartWords.length} words, Required: ${requiredWordMatches}). Transcript snippet from index ${currentTranscriptIndex}: "${transcriptSnippet}..."`);
            return null; 
        }
    }

    if (matchedPartsTimecodes.length > 0 && matchedPartsTimecodes.length === partsStrings.length) { 
        for (const partTc of matchedPartsTimecodes) {
            if (partTc.end < partTc.start) {
                console.warn(`[findBestSubsegment] Invalid timecode for a matched part: start ${partTc.start}, end ${partTc.end}. Quote: "${quoteText}"`);
                return null;
            }
        }
        return matchedPartsTimecodes; 
    }

    console.warn(`[findBestSubsegment] Not all parts of the quote "${quoteText}" were matched successfully. Matched ${matchedPartsTimecodes.length} of ${partsStrings.length} parts.`);
    return null; 
}

// Parse report text and prepare audio segments
async function parseReportAndPrepareAudioSegments(reportText, responseIdToUrlMap = {}) {
    console.log("[parseReportAndPrepareAudioSegments] Parsing report text, length:", reportText.length);
    console.log("[parseReportAndPrepareAudioSegments] Full report text:", reportText);
    
    // Check for audio_clip tags in the input
    const audioClipCheck = reportText.match(/<\s*audio_clip[^>]*>/gi);
    console.log("[parseReportAndPrepareAudioSegments] Found audio_clip tags:", audioClipCheck ? audioClipCheck.length : 0);
    if (audioClipCheck) {
        audioClipCheck.forEach((tag, index) => {
            console.log(`[parseReportAndPrepareAudioSegments] Audio clip tag ${index + 1}:`, tag);
        });
    }
    
    // Debug: show first 500 chars to see format
    console.log("[parseReportAndPrepareAudioSegments] Sample of report text:", reportText.substring(0, 500));
    
    // Handle both audio_clip tags and blockquotes with data-audio-id
    // Split on either format to get all segments
    const robustSplitDelimiterRegex = /(<\s*audio_clip\s+id\s*=\s*["|'][^"|']+["|']\s*>.*?<\/\s*audio_clip\s*>|<\s*blockquote[^>]+data-audio-id\s*=\s*["|'][^"|']+["|'][^>]*>.*?<\/\s*blockquote\s*>)/gis;
    const rawSegments = reportText.split(robustSplitDelimiterRegex);
    
    const processedSegments = [];
    // Create separate regex patterns for each format
    const audioClipRegex = /<\s*audio_clip\s+id\s*=\s*["|']([^"|']+)["|']\s*>\s*(.*?)\s*<\/\s*audio_clip\s*>/is;
    const blockquoteRegex = /<\s*blockquote[^>]+data-audio-id\s*=\s*["|']([^"|']+)["|'][^>]*>\s*(.*?)\s*<\/\s*blockquote\s*>/is;

    console.log("[parseReportAndPrepareAudioSegments] Raw segments count:", rawSegments.length);
    console.log("[parseReportAndPrepareAudioSegments] Response ID map keys:", Object.keys(responseIdToUrlMap));
    console.log("[parseReportAndPrepareAudioSegments] Response ID map:", responseIdToUrlMap);
    
    for (let i = 0; i < rawSegments.length; i++) {
        const rawSegment = rawSegments[i];
        if (rawSegment.trim() === '') continue;
        console.log(`[parseReportAndPrepareAudioSegments] Segment ${i}:`, rawSegment.substring(0, 100));
        
        // Try matching audio_clip format first
        let match = rawSegment.match(audioClipRegex);
        let responseId = null;
        let quoteText = null;
        
        if (match) {
            responseId = match[1];
            quoteText = match[2];
            console.log("[parseReportAndPrepareAudioSegments] Found audio_clip with ID:", responseId);
        } else {
            // Try matching blockquote format
            match = rawSegment.match(blockquoteRegex);
            if (match) {
                responseId = match[1];
                quoteText = match[2];
                console.log("[parseReportAndPrepareAudioSegments] Found blockquote with data-audio-id:", responseId);
            }
        }
        
        if (responseId && quoteText) {
            console.log("[parseReportAndPrepareAudioSegments] Quote text:", quoteText);
            const audioData = responseIdToUrlMap[responseId];
            
            const audioUrl = audioData?.audioUrl || audioData?.url;
            const videoUrl = audioData?.videoUrl;

            if (audioData && (audioUrl || videoUrl)) {
                processedSegments.push({
                    type: 'clip',
                    url: audioUrl,
                    audioUrl: audioUrl,
                    videoUrl: videoUrl,
                    quote: `"${quoteText.trim()}"`,
                    responseId: responseId,
                    word_timestamps: audioData.word_timestamps
                });
                console.log(`[parseReportAndPrepareAudioSegments] Found media clip with ID ${responseId}, matched to URL. Word timestamps count: ${audioData.word_timestamps ? audioData.word_timestamps.length : 0}`);
            } else {
                console.warn(`[parseReportAndPrepareAudioSegments] Audio clip with ID ${responseId} has no matching signed media URL. Converting to text segment.`);
                let cleanedText = quoteText.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
                cleanedText = cleanedText.replace(/^[^a-zA-Z0-9"'(]+/g, '');
                processedSegments.push({
                    type: 'text',
                    content: cleanedText 
                });
            }
        } else {
            // This is a text segment between audio clips
            let cleanedText = rawSegment.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
            cleanedText = cleanedText.replace(/^[^a-zA-Z0-9"'(]+/g, '');
            if (cleanedText) {
                processedSegments.push({
                    type: 'text',
                    content: cleanedText
                });
            }
        }
    }
    console.log("[parseReportAndPrepareAudioSegments] Processed segments:", processedSegments.length);
    return processedSegments;
}

// Generate video files from segments
async function generateVideoFilesFromSegments(segments, openaiClient, tempDir, brollPrompts) {
    console.log(`[generateVideoFilesFromSegments] Generating video for ${segments.length} segments`);
    
    // Ensure brollPrompts is an array
    if (typeof brollPrompts === 'string') {
        try {
            console.log(`[generateVideoFilesFromSegments] brollPrompts received as string, attempting to parse:`, brollPrompts);
            brollPrompts = JSON.parse(brollPrompts);
        } catch (e) {
            console.error(`[generateVideoFilesFromSegments] Failed to parse brollPrompts string:`, e);
            brollPrompts = [];
        }
    } else if (!Array.isArray(brollPrompts)) {
        console.log(`[generateVideoFilesFromSegments] brollPrompts is not an array, type:`, typeof brollPrompts, 'value:', brollPrompts);
        brollPrompts = [];
    }
    
    console.log(`[generateVideoFilesFromSegments] B-roll prompts available: ${brollPrompts?.length || 0}`);
    console.log(`[generateVideoFilesFromSegments] B-roll prompts structure:`, JSON.stringify(brollPrompts));
    const videoFilePaths = [];
    
    // Store the format of the first video clip we encounter
    let referenceVideoFormat = null;
    
    // Track TTS segment index for b-roll prompts
    let ttsSegmentIndex = 0;
    
    // First pass: scan ALL video clips to find the highest quality format
    const videoFormats = [];
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (segment.type === 'clip' && segment.videoUrl) {
            console.log(`[generateVideoFilesFromSegments] Found video clip at segment ${i + 1}, probing for format...`);
            const probeVideoPath = path.join(tempDir, `probe_video_${i}.mp4`);
            
            try {
                // Download just enough to probe the format
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 30000);
                
                const response = await fetch(segment.videoUrl, { 
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; Say-Platform/1.0)'
                    }
                });
                clearTimeout(timeout);
                
                if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);
                
                const videoBuffer = await response.buffer();
                await fs.promises.writeFile(probeVideoPath, videoBuffer);
                
                // Get video format
                const format = await getVideoMetadata(probeVideoPath);
                console.log(`[generateVideoFilesFromSegments] Video ${i + 1} format:`, format.video);
                videoFormats.push(format);
                
                // Clean up probe file
                await fs.promises.unlink(probeVideoPath).catch(() => {});
            } catch (error) {
                console.error(`[generateVideoFilesFromSegments] Error probing video format:`, error);
                // Continue to next video clip
            }
        }
    }
    
    // Choose the highest quality format found (prefer higher resolution)
    if (videoFormats.length > 0) {
        console.log(`[generateVideoFilesFromSegments] Found ${videoFormats.length} video formats to choose from`);
        referenceVideoFormat = videoFormats.reduce((best, current) => {
            const bestPixels = (best.video?.width || 0) * (best.video?.height || 0);
            const currentPixels = (current.video?.width || 0) * (current.video?.height || 0);
            return currentPixels > bestPixels ? current : best;
        });
        console.log(`[generateVideoFilesFromSegments] Selected highest quality format:`, referenceVideoFormat.video);
    } else {
        console.log(`[generateVideoFilesFromSegments] No video formats found, using default 1920x1080 VP9`);
        // Force a high quality default format
        referenceVideoFormat = {
            video: {
                codec: 'vp9',
                width: 1920,
                height: 1080,
                pixFmt: 'yuv420p',
                fps: 30
            }
        };
    }
    
    // If no video format found, log a warning
    if (!referenceVideoFormat) {
        console.warn(`[generateVideoFilesFromSegments] No video clips found to use as reference format. Using defaults.`);
    }

    // Second pass: actually process all segments
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const baseFileName = `segment_${i}_${segment.type}_${Math.random().toString(36).substring(2, 7)}`;
        
        console.log(`[generateVideoFilesFromSegments] Processing segment ${i + 1}/${segments.length} (${segment.type})`);


        if (segment.type === 'text') {
            // Generate TTS audio first
            if (!segment.content || segment.content.trim() === '') {
                console.log(`[generateVideoFilesFromSegments] Skipping empty text segment ${i}`);
                continue;
            }

            try {
                // Check if text is too long for TTS (OpenAI limit is 4096 characters)
                let textToSpeak = segment.content;
                if (textToSpeak.length > 4096) {
                    console.warn(`[generateVideoFilesFromSegments] Text segment ${i} is ${textToSpeak.length} characters, truncating to 4096`);
                    textToSpeak = textToSpeak.substring(0, 4093) + '...';
                }
                
                // Generate TTS audio
                const ttsAudioPath = path.join(tempDir, `${baseFileName}_tts.mp3`);
                console.log(`[generateVideoFilesFromSegments] Generating TTS for: "${textToSpeak.substring(0,30)}..."`);
                console.log(`[generateVideoFilesFromSegments] TTS text length: ${textToSpeak.length} characters`);
                
                // Add timeout and retry logic for TTS generation
                const ttsStartTime = Date.now();
                let ttsResponse;
                let retries = 3;
                let lastError;
                
                while (retries > 0) {
                    try {
                        console.log(`[generateVideoFilesFromSegments] Starting TTS attempt ${4 - retries}/3 with 60s timeout`);
                        const attemptStartTime = Date.now();
                        
                        const ttsPromise = openaiClient.audio.speech.create({
                            model: "tts-1",
                            voice: "alloy",
                            input: textToSpeak.trim(),
                            response_format: "mp3"
                        });
                        
                        const timeoutMs = 60000; // 60 seconds
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error(`TTS generation timed out after ${timeoutMs/1000} seconds`)), timeoutMs)
                        );
                        
                        ttsResponse = await Promise.race([ttsPromise, timeoutPromise]);
                        console.log(`[generateVideoFilesFromSegments] TTS generated successfully in ${Date.now() - attemptStartTime}ms`);
                        break; // Success, exit retry loop
                    } catch (error) {
                        console.error(`[generateVideoFilesFromSegments] TTS attempt failed after ${Date.now() - ttsStartTime}ms:`, error.message);
                        lastError = error;
                        retries--;
                        if (retries > 0) {
                            console.log(`[generateVideoFilesFromSegments] TTS generation failed, retrying... (${retries} retries left)`);
                            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                        }
                    }
                }
                
                if (!ttsResponse) {
                    throw lastError || new Error('TTS generation failed after all retries');
                }
                
                const buffer = Buffer.from(await ttsResponse.arrayBuffer());
                await fs.promises.writeFile(ttsAudioPath, buffer);
                console.log(`[generateVideoFilesFromSegments] TTS audio saved: ${ttsAudioPath}`);

                // Create a video with text overlay for TTS segments
                const videoPath = path.join(tempDir, `${baseFileName}_tts.mp4`);
                
                // Get the b-roll prompt for this TTS segment
                console.log(`[generateVideoFilesFromSegments] Getting b-roll prompt for TTS segment ${ttsSegmentIndex}`);
                console.log(`[generateVideoFilesFromSegments] brollPrompts type:`, typeof brollPrompts);
                console.log(`[generateVideoFilesFromSegments] brollPrompts:`, JSON.stringify(brollPrompts));
                
                // Handle case where brollPrompts might be a string representation of an array
                let parsedBrollPrompts = brollPrompts;
                if (typeof brollPrompts === 'string' && brollPrompts.startsWith('[')) {
                    try {
                        parsedBrollPrompts = JSON.parse(brollPrompts);
                        console.log(`[generateVideoFilesFromSegments] Parsed brollPrompts from string`);
                    } catch (e) {
                        console.log(`[generateVideoFilesFromSegments] Failed to parse brollPrompts as JSON:`, e.message);
                        parsedBrollPrompts = [];
                    }
                }
                
                console.log(`[generateVideoFilesFromSegments] parsedBrollPrompts[${ttsSegmentIndex}]:`, parsedBrollPrompts && parsedBrollPrompts[ttsSegmentIndex]);
                
                const brollPrompt = parsedBrollPrompts && parsedBrollPrompts[ttsSegmentIndex] 
                    ? parsedBrollPrompts[ttsSegmentIndex] 
                    : null;
                
                // Pass b-roll prompt to video creation
                console.log(`[generateVideoFilesFromSegments] Creating TTS video with format:`, referenceVideoFormat?.video);
                await createTextOverlayVideo(segment.content, ttsAudioPath, videoPath, referenceVideoFormat?.video, brollPrompt);
                
                videoFilePaths.push(videoPath);
                console.log(`[generateVideoFilesFromSegments] TTS video created: ${videoPath}`);
                
                // Increment TTS segment counter
                ttsSegmentIndex++;
            } catch (error) {
                console.error(`[generateVideoFilesFromSegments] Error generating TTS video for segment ${i}:`, error);
                // Continue with other segments instead of failing completely
            }
        } else if (segment.type === 'clip') {
            // Handle user video/audio clips
            const mediaData = segment;
            
            if (mediaData.videoUrl) {
                // Download and process video clip
                const rawVideoPath = path.join(tempDir, `${baseFileName}_user_clip_raw.mp4`);
                
                try {
                    console.log(`[generateVideoFilesFromSegments] Downloading video clip from: ${mediaData.videoUrl}`);
                    
                    // Add timeout to prevent hanging
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
                    
                    try {
                        console.log(`[generateVideoFilesFromSegments] Starting fetch request...`);
                        const startTime = Date.now();
                        
                        const response = await fetch(mediaData.videoUrl, { 
                            signal: controller.signal,
                            // Add headers that might help with download
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (compatible; Say-Platform/1.0)'
                            }
                        });
                        clearTimeout(timeout);
                        
                        console.log(`[generateVideoFilesFromSegments] Response received in ${Date.now() - startTime}ms`);
                        console.log(`[generateVideoFilesFromSegments] Response status: ${response.status} ${response.statusText}`);
                        console.log(`[generateVideoFilesFromSegments] Response headers:`, {
                            'content-type': response.headers.get('content-type'),
                            'content-length': response.headers.get('content-length'),
                            'cache-control': response.headers.get('cache-control')
                        });
                        
                        if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);
                        
                        console.log(`[generateVideoFilesFromSegments] Starting to read response body...`);
                        const bufferStart = Date.now();
                        
                        // Use the buffer() method which is supported in node-fetch v2
                        const videoBuffer = await response.buffer();
                        console.log(`[generateVideoFilesFromSegments] Video downloaded in ${Date.now() - bufferStart}ms, total size: ${videoBuffer.length} bytes`);
                        
                        await fs.promises.writeFile(rawVideoPath, videoBuffer);
                        console.log(`[generateVideoFilesFromSegments] Video saved to: ${rawVideoPath}`);
                    } catch (fetchError) {
                        clearTimeout(timeout);
                        if (fetchError.name === 'AbortError') {
                            throw new Error('Video download timed out after 30 seconds');
                        }
                        throw fetchError;
                    }


	                    const createBoundedOrFullVideoFallback = async (reason) => {
	                        const fallbackDuration = estimateDurationFromQuote(mediaData.quote);
	                        if (fallbackDuration) {
	                            console.warn(`[generateVideoFilesFromSegments] ${reason}; using bounded ${fallbackDuration.toFixed(2)}s video fallback`);
	                            const boundedVideoPath = path.join(tempDir, `${baseFileName}_bounded.mp4`);
	                            await extractVideoSegment(rawVideoPath, boundedVideoPath, 0, fallbackDuration);
	                            videoFilePaths.push(boundedVideoPath);
	                            return;
	                        }

	                        console.warn(`[generateVideoFilesFromSegments] ${reason}; no quote duration available, using full video clip`);
	                        const convertedVideoPath = path.join(tempDir, `${baseFileName}_full.mp4`);
	                        await convertVideoToMP4(rawVideoPath, convertedVideoPath);
	                        videoFilePaths.push(convertedVideoPath);
	                    };

	                    // Extract the specific portion based on word timestamps
	                    if (mediaData.word_timestamps && mediaData.word_timestamps.length > 0 && mediaData.quote) {
                        const cleanedTranscriptWords = mediaData.word_timestamps.map(wt => ({
                            text: wt.word.replace(/[^a-zA-Z0-9']/g, "").toLowerCase(),
                            start: wt.start,
                            end: wt.end
                        }));

                        try {
                            const timecodesArray = findBestSubsegment(cleanedTranscriptWords, mediaData.quote);

                            if (timecodesArray && timecodesArray.length > 0) {
                                console.log(`[generateVideoFilesFromSegments] Found ${timecodesArray.length} matching segments for quote`);
                                for (let j = 0; j < timecodesArray.length; j++) {
                                    const partTimecode = timecodesArray[j];
                                    const partVideoPath = path.join(tempDir, `${baseFileName}_part_${j}.mp4`);
                                    
                                    await extractVideoSegment(rawVideoPath, partVideoPath, partTimecode.start, partTimecode.end);
                                    videoFilePaths.push(partVideoPath);
                                }
	                            } else {
	                                await createBoundedOrFullVideoFallback('No matching timestamps found');
	                            }
	                        } catch (matchError) {
	                            console.error(`[generateVideoFilesFromSegments] Error matching timestamps:`, matchError.message);
	                            await createBoundedOrFullVideoFallback('Timestamp matching threw an error');
	                        }
	                    } else {
	                        await createBoundedOrFullVideoFallback('No word timestamps available for video clip');
	                    }
                } catch (error) {
                    console.error(`[generateVideoFilesFromSegments] Error processing video clip:`, error);
                    console.log(`[generateVideoFilesFromSegments] Falling back to audio-only version`);
                    // Fall back to audio-only version
                    await handleAudioOnlyClip(mediaData, tempDir, baseFileName, videoFilePaths, referenceVideoFormat?.video);
                }
            } else if (mediaData.audioUrl || mediaData.url) {
                // No video available, create video from audio
                await handleAudioOnlyClip(mediaData, tempDir, baseFileName, videoFilePaths, referenceVideoFormat?.video);
            }
        }
    }

    return videoFilePaths;
}

// Generate and store report video
async function generateAndStoreReportVideo(reportId, reportText, responsesWithTimestamps, db, storage, gcsBucketName, openaiClient, brollPrompts) {
    let tempDirPath = null;
    console.log(`[generateAndStoreReportVideo ${reportId}] Starting video generation for report.`);

    try {
        if (!reportText || reportText.trim() === '') {
            console.warn(`[generateAndStoreReportVideo ${reportId}] Report content is empty. Skipping video generation.`);
            return null;
        }

        tempDirPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), `report-video-${reportId}-`));
        console.log(`[generateAndStoreReportVideo ${reportId}] Created temp directory: ${tempDirPath}`);

        // Create response ID to video/audio data mapping
        const responseIdToMediaDataMap = {};
        if (responsesWithTimestamps && responsesWithTimestamps.length > 0) {
            responsesWithTimestamps.forEach(response => {
                if (response.id) {
                    responseIdToMediaDataMap[response.id] = {
                        audioUrl: response.audio_signed_url,
                        videoUrl: response.video_signed_url,
                        word_timestamps: response.word_timestamps
                    };
                }
            });
        }
        console.log(`[generateAndStoreReportVideo ${reportId}] Created mapping for ${Object.keys(responseIdToMediaDataMap).length} response IDs.`);

        const segments = await parseReportAndPrepareAudioSegments(reportText, responseIdToMediaDataMap);
        if (!segments || segments.length === 0) {
            console.warn(`[generateAndStoreReportVideo ${reportId}] No segments found. Skipping video generation.`);
            if (tempDirPath) {
                await fs.promises.rm(tempDirPath, { recursive: true, force: true });
            }
            return null;
        }

        // Generate video files for each segment with b-roll prompts
        const videoFiles = await generateVideoFilesFromSegments(segments, openaiClient, tempDirPath, brollPrompts);
        
        if (!videoFiles || videoFiles.length === 0) {
            console.warn(`[generateAndStoreReportVideo ${reportId}] No video files generated.`);
            if (tempDirPath) {
                await fs.promises.rm(tempDirPath, { recursive: true, force: true });
            }
            return null;
        }

        // Stitch video files together
        const finalVideoPath = path.join(tempDirPath, 'final_report_video.mp4');
        await stitchVideoFiles(videoFiles, finalVideoPath);
        console.log(`[generateAndStoreReportVideo ${reportId}] Final video created at: ${finalVideoPath}`);

        // Generate thumbnail
        const thumbnailPath = path.join(tempDirPath, 'thumbnail.jpg');
        try {
            await generateVideoThumbnail(finalVideoPath, thumbnailPath, 2); // Extract frame at 2 seconds
            console.log(`[generateAndStoreReportVideo ${reportId}] Thumbnail generated at: ${thumbnailPath}`);
        } catch (thumbError) {
            console.error(`[generateAndStoreReportVideo ${reportId}] Thumbnail generation failed:`, thumbError);
            // Continue without thumbnail
        }

        // Upload to GCS
        if (storage && gcsBucketName) {
            const bucket = storage.bucket(gcsBucketName);
            const timestamp = Date.now();
            const videoFileName = `reports_video/${reportId}/report_video_${timestamp}.mp4`;
            const thumbnailFileName = `reports_video/${reportId}/thumbnail_${timestamp}.jpg`;
            
            console.log(`[generateAndStoreReportVideo ${reportId}] Uploading to GCS: gs://${gcsBucketName}/${videoFileName}`);
            
            await bucket.upload(finalVideoPath, {
                destination: videoFileName,
                metadata: { contentType: 'video/mp4' },
                resumable: true,
                timeout: 600000, // 10 minute timeout for video (larger files)
                validation: false // Skip MD5 validation for faster uploads
            });
            const gcsVideoUrl = `gs://${gcsBucketName}/${videoFileName}`;
            console.log(`[generateAndStoreReportVideo ${reportId}] Video uploaded to GCS: ${gcsVideoUrl}`);
            
            // Upload thumbnail if it exists
            let gcsThumbnailUrl = null;
            if (fs.existsSync(thumbnailPath)) {
                try {
                    await bucket.upload(thumbnailPath, {
                        destination: thumbnailFileName,
                        metadata: { contentType: 'image/jpeg' },
                        resumable: false,
                        validation: false
                    });
                    gcsThumbnailUrl = `gs://${gcsBucketName}/${thumbnailFileName}`;
                    console.log(`[generateAndStoreReportVideo ${reportId}] Thumbnail uploaded to GCS: ${gcsThumbnailUrl}`);
                } catch (thumbUploadError) {
                    console.error(`[generateAndStoreReportVideo ${reportId}] Thumbnail upload failed:`, thumbUploadError);
                }
            }
            
            // Cleanup
            if (tempDirPath) {
                await fs.promises.rm(tempDirPath, { recursive: true, force: true });
                console.log(`[generateAndStoreReportVideo ${reportId}] Cleaned up temp directory`);
            }
            
            // Return both video and thumbnail URLs
            return {
                videoUrl: gcsVideoUrl,
                thumbnailUrl: gcsThumbnailUrl
            };
        } else {
            console.error(`[generateAndStoreReportVideo ${reportId}] GCS not configured`);
            if (tempDirPath) {
                await fs.promises.rm(tempDirPath, { recursive: true, force: true });
            }
            return null;
        }
    } catch (error) {
        console.error(`[generateAndStoreReportVideo ${reportId}] Error:`, error);
        if (tempDirPath) {
            try {
                await fs.promises.rm(tempDirPath, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error(`[generateAndStoreReportVideo ${reportId}] Cleanup error:`, cleanupError);
            }
        }
        throw error;
    }
}

module.exports = {
    createTextOverlayVideo,
    createAudioVisualizationVideo,
    handleAudioOnlyClip,
    extractVideoSegment,
    convertVideoToMP4,
    stitchVideoFiles,
    getSystemFont,
    levenshteinDistance,
    findBestSubsegment,
    parseReportAndPrepareAudioSegments,
    generateVideoFilesFromSegments,
    generateAndStoreReportVideo,
    getVideoMetadata,
    generateVideoThumbnail
};
