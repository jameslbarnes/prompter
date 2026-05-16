// Simple tests for server-audio.js
// Testing basic functionality without actual audio processing

// Mock ffmpeg-installer modules before importing
jest.mock('@ffmpeg-installer/ffmpeg', () => ({
    path: '/mock/ffmpeg/path'
}));

jest.mock('@ffprobe-installer/ffprobe', () => ({
    path: '/mock/ffprobe/path'
}));

// Mock fs module
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    statSync: jest.fn(),
    promises: {
        mkdtemp: jest.fn(),
        writeFile: jest.fn(),
        rm: jest.fn()
    }
}));

// Mock ffmpeg
jest.mock('fluent-ffmpeg', () => {
    const mockFfmpeg = jest.fn(() => ({
        toFormat: jest.fn().mockReturnThis(),
        input: jest.fn().mockReturnThis(),
        complexFilter: jest.fn().mockReturnThis(),
        outputOptions: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation(function(event, callback) {
            if (event === 'end') {
                // Simulate successful completion
                setTimeout(() => callback(), 0);
            }
            return this;
        }),
        save: jest.fn().mockReturnThis()
    }));
    mockFfmpeg.setFfmpegPath = jest.fn();
    mockFfmpeg.setFfprobePath = jest.fn();
    return mockFfmpeg;
});

// Now require the module after all mocks are set up
const {
    parseReportAndPrepareAudioSegments,
    padAudioFile,
    generateAudioFilesFromSegments,
    stitchAudioFiles,
    generateAndStoreReportAudio
} = require('./server-audio');

describe('server-audio', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('parseReportAndPrepareAudioSegments', () => {
        test('parses text without audio clips', async () => {
            const reportText = 'This is a simple report with no audio.';
            const segments = await parseReportAndPrepareAudioSegments(reportText);
            
            expect(segments).toHaveLength(1);
            expect(segments[0]).toEqual({
                type: 'text',
                content: 'This is a simple report with no audio.'
            });
        });

        test('parses text with audio clips', async () => {
            const reportText = 'Start text [AUDIO_CLIP:resp123] middle text [AUDIO_CLIP:resp456] end text';
            const responseMap = {
                'resp123': { signedUrl: 'url1', word_timestamps: [] },
                'resp456': { signedUrl: 'url2', word_timestamps: [] }
            };
            
            const segments = await parseReportAndPrepareAudioSegments(reportText, responseMap);
            
            expect(segments).toHaveLength(5);
            expect(segments[0].type).toBe('text');
            expect(segments[0].content).toBe('Start text');
            expect(segments[1].type).toBe('audio');
            expect(segments[1].responseId).toBe('resp123');
            expect(segments[2].type).toBe('text');
            expect(segments[2].content).toBe('middle text');
            expect(segments[3].type).toBe('audio');
            expect(segments[3].responseId).toBe('resp456');
            expect(segments[4].type).toBe('text');
            expect(segments[4].content).toBe('end text');
        });

        test('handles missing audio clip data', async () => {
            const reportText = '[AUDIO_CLIP:missing]';
            const segments = await parseReportAndPrepareAudioSegments(reportText, {});
            
            expect(segments).toHaveLength(1);
            expect(segments[0].type).toBe('audio');
            expect(segments[0].responseId).toBe('missing');
            expect(segments[0].audioData).toBeUndefined();
        });
    });

    describe('padAudioFile', () => {
        test('rejects when input file does not exist', async () => {
            const fs = require('fs');
            fs.existsSync.mockReturnValue(false);
            
            await expect(padAudioFile('input.mp3', 'output.mp3'))
                .rejects.toThrow('Input file input.mp3 for padding is missing or empty');
        });

        test('rejects when input file is empty', async () => {
            const fs = require('fs');
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ size: 0 });
            
            await expect(padAudioFile('input.mp3', 'output.mp3'))
                .rejects.toThrow('Input file input.mp3 for padding is missing or empty');
        });
    });

    describe('generateAudioFilesFromSegments', () => {
        test('skips empty text segments', async () => {
            const segments = [
                { type: 'text', content: '' },
                { type: 'text', content: '   ' },
                { type: 'text', content: 'Valid text' }
            ];
            
            const mockOpenAI = {
                audio: {
                    speech: {
                        create: jest.fn().mockResolvedValue({
                            arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
                        })
                    }
                }
            };
            
            const result = await generateAudioFilesFromSegments(segments, mockOpenAI, '/tmp');
            
            // Only one valid segment should generate audio
            expect(mockOpenAI.audio.speech.create).toHaveBeenCalledTimes(1);
            expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith({
                model: 'tts-1',
                voice: 'nova',
                input: 'Valid text',
                response_format: 'mp3'
            });
        });
    });

    describe('stitchAudioFiles', () => {
        test('rejects with empty file list', async () => {
            await expect(stitchAudioFiles([], 'output.mp3'))
                .rejects.toThrow('No audio files to stitch');
        });

        test('processes multiple files', async () => {
            const files = ['file1.mp3', 'file2.mp3', 'file3.mp3'];
            const result = await stitchAudioFiles(files, 'output.mp3');
            
            expect(result).toBe('output.mp3');
        });
    });
});