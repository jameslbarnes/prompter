const ffmpeg = require('fluent-ffmpeg');
const { execSync } = require('child_process');

// Function to check if a command exists
function commandExists(command) {
    try {
        execSync(`which ${command}`, { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

// Function to get FFmpeg version
function getFFmpegVersion(ffmpegPath) {
    try {
        const output = execSync(`${ffmpegPath} -version`, { encoding: 'utf8' });
        const match = output.match(/ffmpeg version ([^\s]+)/);
        return match ? match[1] : 'unknown';
    } catch (e) {
        return 'unknown';
    }
}

// Configure FFmpeg paths
function configureFFmpeg() {
    let ffmpegPath = 'ffmpeg';  // Default to system ffmpeg
    let ffprobePath = 'ffprobe';
    let usingSystemFFmpeg = false;

    // Check if system FFmpeg is available
    if (commandExists('ffmpeg') && commandExists('ffprobe')) {
        console.log('[FFmpeg Config] System FFmpeg found');
        usingSystemFFmpeg = true;
    } else {
        // Try to use ffmpeg-static first (newer version)
        console.log('[FFmpeg Config] System FFmpeg not found, checking for npm packages');
        try {
            const ffmpegStatic = require('ffmpeg-static');
            if (ffmpegStatic) {
                ffmpegPath = ffmpegStatic;
                console.log('[FFmpeg Config] Using ffmpeg-static (newer FFmpeg version)');
                
                // Try to find ffprobe from @ffprobe-installer
                try {
                    const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
                    ffprobePath = ffprobeInstaller.path;
                } catch (e) {
                    console.warn('[FFmpeg Config] FFprobe installer not found, using default path');
                }
            }
        } catch (e) {
            // Fall back to @ffmpeg-installer if ffmpeg-static not available
            console.log('[FFmpeg Config] ffmpeg-static not found, trying @ffmpeg-installer');
            try {
                const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
                const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
                ffmpegPath = ffmpegInstaller.path;
                ffprobePath = ffprobeInstaller.path;
            } catch (e2) {
                console.error('[FFmpeg Config] Failed to load any FFmpeg npm packages:', e2.message);
                // Keep default paths and hope for the best
            }
        }
    }

    // Set the paths
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);

    // Log version info
    const version = getFFmpegVersion(ffmpegPath);
    console.log(`[FFmpeg Config] Using FFmpeg version: ${version}`);
    console.log(`[FFmpeg Config] FFmpeg path: ${ffmpegPath}`);
    console.log(`[FFmpeg Config] FFprobe path: ${ffprobePath}`);
    console.log(`[FFmpeg Config] Using system FFmpeg: ${usingSystemFFmpeg}`);

    return {
        ffmpegPath,
        ffprobePath,
        version,
        usingSystemFFmpeg
    };
}

// Export the configuration function
module.exports = {
    configureFFmpeg,
    commandExists,
    getFFmpegVersion
};