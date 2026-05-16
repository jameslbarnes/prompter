const request = require('supertest');
const { createTestApp, closeTestServer, clearAllMocks } = require('../../test-factory');

describe('Interview API Endpoints', () => {
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

  describe('GET /api/interview/:id', () => {
    it('should return 404 for non-existent interview', async () => {
      const response = await request(app)
        .get('/api/interview/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle database errors gracefully', async () => {
      // Mock Firestore to throw an error
      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/api/interview/test-id')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Failed to fetch interview');
    });
  });

  describe('POST /api/interviews/:id/share', () => {
    it('should require interviewId', async () => {
      const response = await request(app)
        .post('/api/interviews//share')
        .send({ shareEnabled: true })
        .expect(404); // Express will return 404 for empty param
    });

    it('should toggle interview sharing', async () => {
      // Mock successful Firestore update
      const mockDoc = {
        exists: true,
        data: () => ({ shareEnabled: false }),
        ref: { update: jest.fn().mockResolvedValue() }
      };
      
      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockDoc),
          update: jest.fn().mockResolvedValue()
        })
      });

      const response = await request(app)
        .post('/api/interviews/test-id/share')
        .send({ shareEnabled: true })
        .expect(200);

      expect(response.body).toHaveProperty('shareEnabled', true);
      expect(response.body).toHaveProperty('shareUrl');
    });
  });

  describe('POST /api/interviews/:interviewId/upload', () => {
    it('should require a file', async () => {
      const response = await request(app)
        .post('/api/interviews/test-id/upload')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'No file uploaded');
    });

    it('should handle file upload', async () => {
      // Mock successful file processing
      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            add: jest.fn().mockResolvedValue({ id: 'file-id' })
          })
        })
      });

      const response = await request(app)
        .post('/api/interviews/test-id/upload')
        .attach('contextFile', Buffer.from('test content'), 'test.pdf')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'File uploaded successfully');
      expect(response.body).toHaveProperty('fileId');
    });
  });

  describe('GET /api/interview/:interviewId/special-report-details', () => {
    it('should fetch interview report details', async () => {
      // Mock Firestore data
      const mockInterviewData = {
        transcription: 'Test transcription',
        sessionType: 'test',
        responses: ['response1', 'response2']
      };

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => mockInterviewData
          })
        })
      });

      const response = await request(app)
        .get('/api/interview/test-id/special-report-details')
        .expect(200);

      expect(response.body).toHaveProperty('transcription');
      expect(response.body).toHaveProperty('sessionType');
      expect(response.body).toHaveProperty('responses');
    });
  });
});