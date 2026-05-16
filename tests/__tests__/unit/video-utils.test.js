const {
  findBestSubsegment,
  parseReportAndPrepareAudioSegments
} = require('../../../server/utils/video');

describe('video utilities', () => {
  describe('parseReportAndPrepareAudioSegments', () => {
    it('keeps referenced clips when only a video URL is available', async () => {
      const segments = await parseReportAndPrepareAudioSegments(
        'Intro <audio_clip id="response-1">This is the quoted line.</audio_clip> Outro',
        {
          'response-1': {
            videoUrl: 'https://example.com/clip.mp4',
            word_timestamps: [{ word: 'This', start: 0, end: 0.2 }]
          }
        }
      );

      const clip = segments.find(segment => segment.type === 'clip');

      expect(clip).toMatchObject({
        type: 'clip',
        responseId: 'response-1',
        videoUrl: 'https://example.com/clip.mp4'
      });
    });

    it('normalizes legacy url fields into audioUrl for audio-only clips', async () => {
      const segments = await parseReportAndPrepareAudioSegments(
        'Intro <audio_clip id="response-2">This is the quoted audio line.</audio_clip> Outro',
        {
          'response-2': {
            url: 'https://example.com/clip.mp3',
            word_timestamps: [{ word: 'This', start: 0, end: 0.2 }]
          }
        }
      );

      const clip = segments.find(segment => segment.type === 'clip');

      expect(clip).toMatchObject({
        type: 'clip',
        responseId: 'response-2',
        url: 'https://example.com/clip.mp3',
        audioUrl: 'https://example.com/clip.mp3'
      });
      expect(clip.videoUrl).toBeUndefined();
    });
  });

  describe('findBestSubsegment', () => {
    it('matches quoted text with wrapper punctuation to transcript timestamps', () => {
      const match = findBestSubsegment(
        [
          { text: 'we', start: 0, end: 0.1 },
          { text: 'need', start: 0.1, end: 0.25 },
          { text: 'better', start: 0.25, end: 0.45 },
          { text: 'tools', start: 0.45, end: 0.7 },
          { text: 'now', start: 0.7, end: 0.9 }
        ],
        '"better tools"'
      );

      expect(match).toEqual([{ start: 0.25, end: 0.7 }]);
    });

    it('uses anchors for long quotes when the middle has transcript drift', () => {
      const transcriptWords = [
        'before', 'we', 'start', 'with', 'the', 'same', 'opening', 'words', 'and',
        'then', 'the', 'speaker', 'wanders', 'through', 'a', 'long', 'middle',
        'before', 'landing', 'on', 'the', 'same', 'closing', 'words', 'today', 'after'
      ].map((text, index) => ({ text, start: index, end: index + 0.5 }));

      const match = findBestSubsegment(
        transcriptWords,
        'we start with the same opening words and then a heavily edited middle section before landing on the same closing words today'
      );

      expect(match).toEqual([{ start: 1, end: 24.5 }]);
    });
  });
});
