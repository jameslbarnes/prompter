// Audio processing functions extracted from server.js
// This module contains all audio-related functionality

const fs = require('fs');
const path = require('path');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');

// Set FFmpeg paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// Function to generate speech from text using OpenAI TTS
async function generateSpeechFromText(text, socket, openai) {
    if (!text || text.trim() === '') {
        console.warn("[TTS] Input text for speech generation was empty.");
        return; 
    }
    if (!socket) {
        console.error("[TTS] Socket object not provided to generateSpeechFromText. Cannot stream audio.");
        return;
    }
    try {
        return // This return statement seems to be a bug in original code
        console.log(`[TTS - ${socket.id}] Requesting speech for text: "${text.substring(0, 50)}..."`);
        const speechResponse = await openai.audio.speech.create({
            model: "gpt-4o-mini-tts",
            voice: "nova",    
            instructions: "Speak like a podcast host",
            input: text,
            response_format: "mp3"
        });

        if (!speechResponse.body) {
            console.error(`[TTS - ${socket.id}] ReadableStream (speechResponse.body) not available in speech response.`);
            socket.emit('ttsError', { message: 'Failed to get audio stream from provider.' });
            return;
        }

        console.log(`[TTS - ${socket.id}] Starting TTS audio stream...`);
        // Stream the response
        for await (const chunk of speechResponse.body) {
            socket.emit('questionAudioChunk', chunk);
        }
        socket.emit('questionAudioEnd');
        console.log(`[TTS - ${socket.id}] TTS audio stream ended.`);

    } catch (error) {
        console.error(`[TTS - ${socket.id}] Error generating or streaming speech with OpenAI TTS:`, error);
        if (error.response && error.response.data) {
            console.error(`[TTS - ${socket.id}] OpenAI TTS API Error Response:`, JSON.stringify(error.response.data, null, 2));
        }
        socket.emit('ttsError', { message: 'Failed to generate question audio.' });
    }
}

// Parse report and prepare audio segments
async function parseReportAndPrepareAudioSegments(reportText, responseIdToUrlMap = {}) {
    const segments = [];
    console.log("[parseReportAndPrepareAudioSegments] Parsing report text, length:", reportText.length);
    
    // Regex to find audio clip placeholders
    const audioClipRegex = /\[AUDIO_CLIP:([^\]]+)\]/g;
    let lastIndex = 0;
    let match;
    
    while ((match = audioClipRegex.exec(reportText)) !== null) {
        // Add text segment before the audio clip
        if (match.index > lastIndex) {
            const textContent = reportText.substring(lastIndex, match.index).trim();
            if (textContent) {
                segments.push({ type: 'text', content: textContent });
            }
        }
        
        // Add audio segment
        const responseId = match[1];
        const audioData = responseIdToUrlMap[responseId];
        if (audioData && audioData.signedUrl) {
            console.log(`[parseReportAndPrepareAudioSegments] Found audio clip with ID ${responseId}, matched to URL. Word timestamps count: ${audioData.word_timestamps ? audioData.word_timestamps.length : 0}`);
        } else {
            console.warn(`[parseReportAndPrepareAudioSegments] Audio clip with ID ${responseId} has no matching signed URL or audio data. Converting to text segment.`);
        }
        segments.push({ type: 'audio', responseId, audioData });
        
        lastIndex = match.index + match[0].length;
    }
    
    // Add any remaining text after the last audio clip
    if (lastIndex < reportText.length) {
        const textContent = reportText.substring(lastIndex).trim();
        if (textContent) {
            segments.push({ type: 'text', content: textContent });
        }
    }

    // Process segments further if needed
    const processedSegments = segments; // Add processing logic here if needed
    
    console.log("[parseReportAndPrepareAudioSegments] Processed segments:", processedSegments.length);
    return processedSegments;
}

// Pad audio file with silence
async function padAudioFile(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log(`[padAudioFile] Padding audio: ${inputPath} -> ${outputPath}`);
        if (!fs.existsSync(inputPath) || fs.statSync(inputPath).size === 0) {
            console.warn(`[padAudioFile] Input file ${inputPath} is missing or empty. Skipping padding.`);
            return reject(new Error(`Input file ${inputPath} for padding is missing or empty.`));
        }

        ffmpeg(inputPath)
            .toFormat('mp3')
            .on('error', (err) => {
                console.error(`[padAudioFile] FFmpeg error padding ${inputPath}:`, err.message);
                reject(err);
            })
            .on('end', () => {
                console.log(`[padAudioFile] Successfully padded ${inputPath} to ${outputPath}`);
                resolve(outputPath);
            })
            .save(outputPath);
    });
}

// Generate audio files from segments
async function generateAudioFilesFromSegments(segments, openaiClient, tempDir) {
    console.log(`[generateAudioFilesFromSegments] Generating audio for ${segments.length} segments in ${tempDir}`);
    const audioFiles = [];
    
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        if (segment.type === 'text') {
            if (!segment.content || segment.content.trim() === '') {
                console.log(`[generateAudioFilesFromSegments] Skipping empty text segment ${i}.`);
                continue;
            }
            try {
                console.log(`[generateAudioFilesFromSegments] Generating TTS for: "${segment.content.substring(0,30)}..."`);
                
                // Generate speech
                const speechResponse = await openaiClient.audio.speech.create({
                    model: "tts-1",
                    voice: "nova",
                    input: segment.content,
                    response_format: "mp3"
                });

                // Save to file
                const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());
                const fileName = `segment_${i}_${Date.now()}.mp3`;
                const filePath = path.join(tempDir, fileName);
                
                await fs.promises.writeFile(filePath, audioBuffer);
                audioFiles.push(filePath);
                
                console.log(`[generateAudioFilesFromSegments] Generated TTS file: ${fileName}`);
            } catch (error) {
                console.error(`[generateAudioFilesFromSegments] Error generating TTS for segment ${i}:`, error);
                throw error;
            }
        } else if (segment.type === 'audio' && segment.audioData && segment.audioData.signedUrl) {
            // Handle audio clip - implementation would download from signed URL
            console.log(`[generateAudioFilesFromSegments] Would download audio from signed URL for segment ${i}`);
            // Placeholder - actual implementation would download the audio file
        }
    }
    
    return audioFiles;
}

// Stitch multiple audio files together
async function stitchAudioFiles(audioFilePaths, finalOutputPath) {
    return new Promise((resolve, reject) => {
        console.log(`[stitchAudioFiles] Stitching ${audioFilePaths.length} audio files to ${finalOutputPath}`);
        
        if (audioFilePaths.length === 0) {
            reject(new Error('No audio files to stitch'));
            return;
        }

        const command = ffmpeg();
        
        // Add all input files
        audioFilePaths.forEach(filePath => {
            command.input(filePath);
        });

        // Create concat filter
        const filterInputs = audioFilePaths.map((_, index) => `[${index}:a]`).join('');
        const filterString = `${filterInputs}concat=n=${audioFilePaths.length}:v=0:a=1[out]`;

        command
            .complexFilter(filterString)
            .outputOptions([
                '-map', '[out]',
                '-acodec', 'libmp3lame',
                '-b:a', '192k'
            ])
            .on('start', (cmd) => {
                console.log('[stitchAudioFiles] FFmpeg command:', cmd);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`[stitchAudioFiles] Processing: ${progress.percent.toFixed(1)}%`);
                }
            })
            .on('end', () => {
                console.log('[stitchAudioFiles] Audio stitching completed successfully');
                resolve(finalOutputPath);
            })
            .on('error', (err) => {
                console.error('[stitchAudioFiles] Error during audio stitching:', err);
                reject(err);
            })
            .save(finalOutputPath);
    });
}

// Main function to generate and store report audio
async function generateAndStoreReportAudio(reportId, reportText, responsesWithTimestamps, db, storage, gcsBucketName, openaiClient) {
    console.log(`[generateAndStoreReportAudio] Starting audio generation for report ${reportId}`);
    
    // Create temp directory
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'report-audio-'));
    
    try {
        // Parse report and prepare segments
        const responseIdToUrlMap = {};
        responsesWithTimestamps.forEach(response => {
            if (response.id && response.signedUrl) {
                responseIdToUrlMap[response.id] = {
                    signedUrl: response.signedUrl,
                    word_timestamps: response.word_timestamps || []
                };
            }
        });
        
        const segments = await parseReportAndPrepareAudioSegments(reportText, responseIdToUrlMap);
        
        // Generate audio files
        const audioFiles = await generateAudioFilesFromSegments(segments, openaiClient, tempDir);
        
        if (audioFiles.length === 0) {
            console.log('[generateAndStoreReportAudio] No audio files generated');
            return null;
        }
        
        // Stitch audio files together
        const finalAudioPath = path.join(tempDir, `report_${reportId}_final.mp3`);
        await stitchAudioFiles(audioFiles, finalAudioPath);
        
        // Upload to GCS
        const gcsFileName = `reports/${reportId}/audio/${reportId}_report_audio.mp3`;
        const bucket = storage.bucket(gcsBucketName);
        const file = bucket.file(gcsFileName);
        
        await bucket.upload(finalAudioPath, {
            destination: gcsFileName,
            metadata: {
                contentType: 'audio/mpeg',
                metadata: {
                    reportId: reportId,
                    generatedAt: new Date().toISOString()
                }
            }
        });
        
        console.log(`[generateAndStoreReportAudio] Audio uploaded to GCS: ${gcsFileName}`);
        
        // Update Firestore with audio path
        if (db) {
            await db.collection('reports').doc(reportId).update({
                audioGcsPath: gcsFileName,
                audioGeneratedAt: new Date().toISOString()
            });
        }
        
        return gcsFileName;
        
    } catch (error) {
        console.error('[generateAndStoreReportAudio] Error:', error);
        throw error;
    } finally {
        // Cleanup temp directory
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
            console.log('[generateAndStoreReportAudio] Cleaned up temp directory');
        } catch (cleanupError) {
            console.error('[generateAndStoreReportAudio] Error cleaning up temp directory:', cleanupError);
        }
    }
}

module.exports = {
    generateSpeechFromText,
    parseReportAndPrepareAudioSegments,
    padAudioFile,
    generateAudioFilesFromSegments,
    stitchAudioFiles,
    generateAndStoreReportAudio
};