const request = require('supertest');
const { createTestApp, closeTestServer, clearAllMocks } = require('../../test-factory');

describe('Admin API Endpoints', () => {
  let app, server;

  beforeAll(() => {
    const testApp = createTestApp();
    app = testApp.app;
    server = testApp.server;
  });

  afterAll(async () => {
    await closeTestServer(server);
  });

  afterEach(() => {
    clearAllMocks();
  });

  describe('GET /api/admin/my-sessions', () => {
    it('should require userEmail parameter', async () => {
      const response = await request(app)
        .get('/api/admin/my-sessions')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'userEmail is required');
    });

    it('should return user sessions', async () => {
      // Mock Firestore queries for both regular and voice reports
      const mockRegularReports = [
        {
          id: 'report1',
          data: () => ({
            title: 'Regular Report',
            createdAt: new Date(),
            status: 'completed',
            responseCount: 5
          })
        }
      ];

      const mockVoiceReports = [
        {
          id: 'voice1',
          data: () => ({
            interviewType: 'voice',
            transcription: 'Voice interview transcript',
            createdAt: new Date()
          })
        }
      ];

      const mockFirestore = require('firebase-admin').firestore();
      let callCount = 0;
      
      mockFirestore.collection.mockImplementation(() => {
        return {
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue({
                  docs: callCount++ === 0 ? mockRegularReports : mockVoiceReports
                })
              })
            })
          })
        };
      });

      const response = await request(app)
        .get('/api/admin/my-sessions')
        .query({ userEmail: 'test@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('regularReports');
      expect(response.body).toHaveProperty('voiceInterviews');
      expect(response.body.regularReports).toHaveLength(1);
      expect(response.body.voiceInterviews).toHaveLength(1);
    });

    it('should limit results', async () => {
      const mockFirestore = require('firebase-admin').firestore();
      const mockLimit = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ docs: [] })
      });

      mockFirestore.collection.mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: mockLimit
          })
        })
      });

      await request(app)
        .get('/api/admin/my-sessions')
        .query({ 
          userEmail: 'test@example.com',
          limit: 25
        })
        .expect(200);

      expect(mockLimit).toHaveBeenCalledWith(25);
    });
  });

  describe('POST /api/reports/:reportId/regenerate-admin-summary', () => {
    it('should regenerate admin summary for report', async () => {
      const reportId = 'test-report-123';
      
      // Mock the report data
      const mockReportData = {
        responses: [
          { question: 'Q1', answer: 'A1' },
          { question: 'Q2', answer: 'A2' }
        ],
        userEmail: 'test@example.com',
        userName: 'Test User'
      };

      const mockFirestore = require('firebase-admin').firestore();
      const mockUpdate = jest.fn().mockResolvedValue();
      
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => mockReportData
          }),
          update: mockUpdate
        })
      });

      const response = await request(app)
        .post(`/api/reports/${reportId}/regenerate-admin-summary`)
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should return 404 for non-existent report', async () => {
      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: false
          })
        })
      });

      const response = await request(app)
        .post('/api/reports/non-existent/regenerate-admin-summary')
        .send({})
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Report not found');
    });

    it('should handle regeneration errors', async () => {
      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ responses: [] })
          }),
          update: jest.fn().mockRejectedValue(new Error('Update failed'))
        })
      });

      const response = await request(app)
        .post('/api/reports/test-report/regenerate-admin-summary')
        .send({})
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
    });
  });

  describe('GET /api/syntheses/:synthesisId/audio-artifact', () => {
    it('should stream synthesis audio file', async () => {
      const synthesisId = 'test-synthesis';
      
      // Mock Firestore
      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ audioArtifactPath: 'audio/synthesis.mp3' })
          })
        })
      });

      // Mock Google Cloud Storage
      const mockStorage = require('@google-cloud/storage').Storage;
      const { Readable } = require('stream');
      const mockStream = new Readable();
      mockStream.push('mock audio data');
      mockStream.push(null);
      
      mockStorage.mockReturnValue({
        bucket: jest.fn().mockReturnValue({
          file: jest.fn().mockReturnValue({
            exists: jest.fn().mockResolvedValue([true]),
            createReadStream: jest.fn().mockReturnValue(mockStream)
          })
        })
      });

      const response = await request(app)
        .get(`/api/syntheses/${synthesisId}/audio-artifact`)
        .expect(200);

      expect(response.headers['content-type']).toBe('audio/mpeg');
    });

    it('should return 404 for synthesis without audio', async () => {
      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({}) // No audioArtifactPath
          })
        })
      });

      const response = await request(app)
        .get('/api/syntheses/test-synthesis/audio-artifact')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'No audio artifact found for this synthesis');
    });
  });
});