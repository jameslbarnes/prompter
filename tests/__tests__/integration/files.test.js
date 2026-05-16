const request = require('supertest');
const { createTestApp, closeTestServer, clearAllMocks } = require('../../test-factory');

describe('Files API Endpoints', () => {
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

  describe('POST /api/upload-resume', () => {
    it('should require a file', async () => {
      const response = await request(app)
        .post('/api/upload-resume')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'No file uploaded');
    });

    it('should accept PDF files', async () => {
      const mockPdfContent = Buffer.from('Mock PDF content');
      
      const response = await request(app)
        .post('/api/upload-resume')
        .attach('resume', mockPdfContent, {
          filename: 'test-resume.pdf',
          contentType: 'application/pdf'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Resume uploaded and processed successfully');
      expect(response.body).toHaveProperty('fileInfo');
      expect(response.body).toHaveProperty('extractedText');
    });

    it('should accept Word documents', async () => {
      const mockDocContent = Buffer.from('Mock Word content');
      
      const response = await request(app)
        .post('/api/upload-resume')
        .attach('resume', mockDocContent, {
          filename: 'test-resume.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Resume uploaded and processed successfully');
      expect(response.body).toHaveProperty('fileInfo');
    });

    it('should reject invalid file types', async () => {
      const mockInvalidFile = Buffer.from('Invalid file content');
      
      const response = await request(app)
        .post('/api/upload-resume')
        .attach('resume', mockInvalidFile, {
          filename: 'test.txt',
          contentType: 'text/plain'
        });

      // Multer should reject this before it reaches our handler
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('DELETE /api/files', () => {
    it('should require fileId parameter', async () => {
      const response = await request(app)
        .delete('/api/files')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'fileId is required');
    });

    it('should delete file from storage and database', async () => {
      // Mock Google Cloud Storage
      const mockStorage = require('@google-cloud/storage').Storage;
      const mockDelete = jest.fn().mockResolvedValue();
      mockStorage.mockReturnValue({
        bucket: jest.fn().mockReturnValue({
          file: jest.fn().mockReturnValue({
            delete: mockDelete
          })
        })
      });

      // Mock Firestore
      const mockFirestore = require('firebase-admin').firestore();
      const mockDocDelete = jest.fn().mockResolvedValue();
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ gcsPath: 'path/to/file' })
          }),
          delete: mockDocDelete
        })
      });

      const response = await request(app)
        .delete('/api/files')
        .query({ fileId: 'test-file-id' })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'File deleted successfully');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDocDelete).toHaveBeenCalled();
    });

    it('should return 404 for non-existent file', async () => {
      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: false
          })
        })
      });

      const response = await request(app)
        .delete('/api/files')
        .query({ fileId: 'non-existent' })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'File not found');
    });
  });

  describe('GET /api/reports/:reportId/audio-artifact', () => {
    it('should stream audio file for valid report', async () => {
      // Mock Firestore
      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ audioArtifactPath: 'audio/test.mp3' })
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
        .get('/api/reports/test-report/audio-artifact')
        .expect(200);

      expect(response.headers['content-type']).toBe('audio/mpeg');
    });

    it('should return 404 for report without audio', async () => {
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
        .get('/api/reports/test-report/audio-artifact')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'No audio artifact found for this report');
    });
  });
});