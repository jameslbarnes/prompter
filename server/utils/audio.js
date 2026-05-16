const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const path = require('path');
const fs = require('fs').promises;

// Set FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// Function to pad audio file with silence
async function padAudioFile(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-af', 'apad=pad_dur=0.5'  // Add 0.5 seconds of silence
            ])
            .on('end', () => {
                console.log(`[Audio] Successfully padded file: ${path.basename(outputPath)}`);
                resolve();
            })
            .on('error', (err) => {
                console.error(`[Audio] Error padding file: ${err.message}`);
                reject(err);
            })
            .save(outputPath);
    });
}

// Function to stitch multiple audio files together
async function stitchAudioFiles(audioFilePaths, finalOutputPath) {
    return new Promise((resolve, reject) => {
        console.log(`[Audio] Starting to stitch ${audioFilePaths.length} audio files`);

        const command = ffmpeg();
        
        // Add all input files
        audioFilePaths.forEach(filePath => {
            command.input(filePath);
        });

        // Create filter complex for concatenation
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
                console.log('[Audio] FFmpeg command:', cmd);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`[Audio] Processing: ${progress.percent.toFixed(1)}%`);
                }
            })
            .on('end', () => {
                console.log('[Audio] Audio stitching completed successfully');
                resolve(finalOutputPath);
            })
            .on('error', (err) => {
                console.error('[Audio] Error during audio stitching:', err);
                reject(err);
            })
            .save(finalOutputPath);
    });
}

// Function to find best subsegment match in transcript
function findBestSubsegment(transcriptWords, quoteText) {
    if (!transcriptWords || transcriptWords.length === 0) {
        console.log('[Audio] No transcript words available');
        return null;
    }

    const quoteWords = quoteText.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    if (quoteWords.length === 0) {
        console.log('[Audio] No quote words to match');
        return null;
    }

    let bestMatch = null;
    let bestScore = Infinity;
    const windowSize = Math.max(quoteWords.length, 3);

    // Try different window sizes
    for (let currentWindowSize = windowSize; currentWindowSize <= windowSize + 5; currentWindowSize++) {
        for (let i = 0; i <= transcriptWords.length - currentWindowSize; i++) {
            const windowWords = transcriptWords.slice(i, i + currentWindowSize)
                .map(w => w.word.toLowerCase());

            // Calculate similarity score
            let matchCount = 0;
            for (const quoteWord of quoteWords) {
                if (windowWords.includes(quoteWord)) {
                    matchCount++;
                }
            }

            // Calculate position-aware score
            let positionScore = 0;
            for (let j = 0; j < Math.min(quoteWords.length, windowWords.length); j++) {
                if (quoteWords[j] === windowWords[j]) {
                    positionScore += 2; // Bonus for matching position
                }
            }

            const totalScore = (quoteWords.length - matchCount) + (currentWindowSize - quoteWords.length) * 0.5 - positionScore;

            if (totalScore < bestScore && matchCount >= quoteWords.length * 0.6) {
                bestScore = totalScore;
                bestMatch = {
                    startIndex: i,
                    endIndex: i + currentWindowSize - 1,
                    startTime: transcriptWords[i].start,
                    endTime: transcriptWords[i + currentWindowSize - 1].end,
                    matchedWords: windowWords,
                    score: totalScore,
                    matchPercentage: (matchCount / quoteWords.length) * 100
                };
            }
        }
    }

    return bestMatch;
}

module.exports = {
    padAudioFile,
    stitchAudioFiles,
    findBestSubsegment
};