const request = require('supertest');
const { createTestApp, closeTestServer, clearAllMocks } = require('../../test-factory');

describe('Reports API Endpoints', () => {
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

  describe('GET /api/reports', () => {
    it('should return list of reports', async () => {
      // Mock Firestore query
      const mockDocs = [
        {
          id: 'report1',
          data: () => ({
            title: 'Test Report 1',
            createdAt: new Date(),
            userId: 'user1'
          })
        },
        {
          id: 'report2',
          data: () => ({
            title: 'Test Report 2',
            createdAt: new Date(),
            userId: 'user2'
          })
        }
      ];

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection.mockReturnValue({
        orderBy: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ docs: mockDocs })
          })
        })
      });

      const response = await request(app)
        .get('/api/reports')
        .query({ limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('reports');
      expect(Array.isArray(response.body.reports)).toBe(true);
      expect(response.body.reports).toHaveLength(2);
    });

    it('should filter reports by userId', async () => {
      const mockDocs = [{
        id: 'report1',
        data: () => ({
          title: 'User Report',
          userId: 'specific-user'
        })
      }];

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection.mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({ docs: mockDocs })
            })
          })
        })
      });

      const response = await request(app)
        .get('/api/reports')
        .query({ userId: 'specific-user' })
        .expect(200);

      expect(response.body.reports).toHaveLength(1);
      expect(response.body.reports[0].userId).toBe('specific-user');
    });
  });

  describe('GET /api/reports/:id', () => {
    it('should return specific report by ID', async () => {
      const mockReportData = {
        title: 'Test Report',
        content: 'Report content',
        createdAt: new Date(),
        userId: 'user1'
      };

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            id: 'report1',
            data: () => mockReportData
          })
        })
      });

      const response = await request(app)
        .get('/api/reports/report1')
        .expect(200);

      expect(response.body).toHaveProperty('id', 'report1');
      expect(response.body).toHaveProperty('title', mockReportData.title);
      expect(response.body).toHaveProperty('content', mockReportData.content);
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
        .get('/api/reports/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Report not found');
    });
  });

  describe('GET /api/reports/latest', () => {
    it('should return the latest report', async () => {
      const mockDoc = {
        id: 'latest-report',
        data: () => ({
          title: 'Latest Report',
          createdAt: new Date()
        })
      };

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection.mockReturnValue({
        orderBy: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({
              empty: false,
              docs: [mockDoc]
            })
          })
        })
      });

      const response = await request(app)
        .get('/api/reports/latest')
        .expect(200);

      expect(response.body).toHaveProperty('id', 'latest-report');
      expect(response.body).toHaveProperty('title', 'Latest Report');
    });
  });

  describe('POST /api/reports/:reportId/regenerate-user-report', () => {
    it('should require reportId', async () => {
      const response = await request(app)
        .post('/api/reports//regenerate-user-report')
        .send({})
        .expect(404);
    });

    it('should regenerate user report', async () => {
      // Mock existing report
      const mockReportData = {
        interviewId: 'interview1',
        responses: ['response1', 'response2'],
        userEmail: 'test@example.com'
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
        .post('/api/reports/report1/regenerate-user-report')
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});