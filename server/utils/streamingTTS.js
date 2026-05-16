// Streaming TTS with chunk encoding using Server-Sent Events (SSE)
// Based on the technique described in: https://medium.com/@pshanarat/tts-text-to-speech-streaming-with-chunk-encoding-a-technique-used-by-openai-4852458f7270

const { Readable } = require('stream');

class StreamingTTSService {
    constructor(openai) {
        this.openai = openai;
        this.chunkSize = 4096; // Size of audio chunks to stream
    }

    /**
     * Handle SSE streaming request for TTS
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     */
    async handleStreamRequest(req, res) {
        const { text, voice = 'nova', speed = 1.1 } = req.method === 'GET' ? req.query : req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Text is required' });
        }

        if (!this.openai) {
            return res.status(503).json({ error: 'OpenAI client not initialized' });
        }

        // Set up SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Send initial connection message
        res.write('event: connected\ndata: {"status": "connected"}\n\n');

        try {
            console.log(`[StreamingTTS] Generating speech for: "${text.substring(0, 50)}..."`);

            // Generate TTS using OpenAI with streaming
            const mp3Response = await this.openai.audio.speech.create({
                model: "tts-1",
                voice: voice,
                input: text,
                response_format: "mp3",
                speed: speed
            });

            // Convert response to stream
            const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
            
            // Stream audio in chunks
            let offset = 0;
            let chunkIndex = 0;

            while (offset < audioBuffer.length) {
                const chunk = audioBuffer.slice(offset, offset + this.chunkSize);
                const base64Chunk = chunk.toString('base64');
                
                // Send chunk as SSE event
                const eventData = {
                    chunk: base64Chunk,
                    index: chunkIndex,
                    isLast: offset + this.chunkSize >= audioBuffer.length
                };

                res.write(`event: audioChunk\ndata: ${JSON.stringify(eventData)}\n\n`);
                
                offset += this.chunkSize;
                chunkIndex++;

                // Small delay to prevent overwhelming the client
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Send completion event
            res.write('event: complete\ndata: {"status": "complete"}\n\n');

        } catch (error) {
            console.error('[StreamingTTS] Error generating speech:', error);
            
            // Send error event
            const errorData = {
                error: 'Failed to generate speech',
                details: error.message
            };
            res.write(`event: error\ndata: ${JSON.stringify(errorData)}\n\n`);
        } finally {
            res.end();
        }
    }

    /**
     * Handle chunked text streaming with real-time TTS generation
     * This endpoint accepts text chunks and generates audio on-the-fly
     */
    async handleChunkedStreamRequest(req, res) {
        const { voice = 'nova', speed = 1.1 } = req.query;

        // Set up SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Send initial connection message
        res.write('event: connected\ndata: {"status": "connected"}\n\n');

        // Buffer for accumulating text chunks
        let textBuffer = '';
        let isProcessing = false;
        const minChunkSize = 30; // Minimum characters before generating audio

        // Handle incoming text chunks
        req.on('data', (chunk) => {
            textBuffer += chunk.toString();
            
            // Process buffer if we have enough text and not already processing
            if (!isProcessing && this.shouldProcessBuffer(textBuffer, minChunkSize)) {
                isProcessing = true;
                this.processTextBuffer(textBuffer, res, voice, speed).then(() => {
                    isProcessing = false;
                });
                textBuffer = '';
            }
        });

        // Handle connection close
        req.on('end', async () => {
            // Process any remaining text
            if (textBuffer.trim().length > 0) {
                await this.processTextBuffer(textBuffer, res, voice, speed);
            }
            res.write('event: complete\ndata: {"status": "complete"}\n\n');
            res.end();
        });

        req.on('error', (error) => {
            console.error('[StreamingTTS] Request error:', error);
            res.end();
        });
    }

    /**
     * Determine if buffer should be processed based on content
     */
    shouldProcessBuffer(text, minSize) {
        // Process on sentence boundaries
        const sentenceEnders = ['.', '!', '?', ':', ';'];
        const lastChar = text.trim().slice(-1);
        if (sentenceEnders.includes(lastChar)) {
            return true;
        }

        // Process on natural pauses if we have enough text
        const pauseChars = [',', '-', '—', '\n'];
        if (pauseChars.includes(lastChar) && text.length > minSize) {
            return true;
        }

        // Process if buffer is getting large
        return text.length > 80;
    }

    /**
     * Process text buffer and stream audio chunks
     */
    async processTextBuffer(text, res, voice, speed) {
        if (!text.trim()) return;

        try {
            // Generate audio for text chunk
            const mp3Response = await this.openai.audio.speech.create({
                model: "tts-1",
                voice: voice,
                input: text.trim(),
                response_format: "mp3",
                speed: speed
            });

            const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
            
            // Stream audio in small chunks
            let offset = 0;
            while (offset < audioBuffer.length) {
                const chunk = audioBuffer.slice(offset, offset + this.chunkSize);
                const base64Chunk = chunk.toString('base64');
                
                const eventData = {
                    chunk: base64Chunk,
                    text: text.trim().substring(0, 50) + '...', // Include partial text for debugging
                    isPartial: true
                };

                res.write(`event: audioChunk\ndata: ${JSON.stringify(eventData)}\n\n`);
                
                offset += this.chunkSize;
                await new Promise(resolve => setTimeout(resolve, 5));
            }

        } catch (error) {
            console.error('[StreamingTTS] Error processing text buffer:', error);
            const errorData = {
                error: 'Failed to process text chunk',
                details: error.message
            };
            res.write(`event: error\ndata: ${JSON.stringify(errorData)}\n\n`);
        }
    }
}

module.exports = StreamingTTSService;