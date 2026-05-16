const request = require('supertest');
const { createTestApp, closeTestServer, clearAllMocks } = require('../../test-factory');

describe('Pricing/Subscription API Endpoints', () => {
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

  describe('GET /api/subscription', () => {
    it('should require userId parameter', async () => {
      const response = await request(app)
        .get('/api/subscription')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'userId is required');
    });

    it('should return subscription status for user', async () => {
      // Mock pricing service
      global.pricingService = {
        getSubscriptionStatus: jest.fn().mockResolvedValue({
          hasActiveSubscription: true,
          plan: 'pro',
          status: 'active',
          currentPeriodEnd: new Date()
        })
      };

      const response = await request(app)
        .get('/api/subscription')
        .query({ userId: 'test-user' })
        .expect(200);

      expect(response.body).toHaveProperty('hasActiveSubscription', true);
      expect(response.body).toHaveProperty('plan', 'pro');
      expect(response.body).toHaveProperty('status', 'active');
    });

    it('should handle users without subscription', async () => {
      global.pricingService = {
        getSubscriptionStatus: jest.fn().mockResolvedValue({
          hasActiveSubscription: false,
          plan: null,
          status: 'inactive'
        })
      };

      const response = await request(app)
        .get('/api/subscription')
        .query({ userId: 'free-user' })
        .expect(200);

      expect(response.body).toHaveProperty('hasActiveSubscription', false);
      expect(response.body.plan).toBeNull();
    });
  });

  describe('POST /api/subscription/checkout', () => {
    it('should require userId and priceId', async () => {
      const response = await request(app)
        .post('/api/subscription/checkout')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'userId and priceId are required');
    });

    it('should create checkout session', async () => {
      // Mock Stripe
      const mockStripe = require('stripe')();
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/test-session'
      });

      const response = await request(app)
        .post('/api/subscription/checkout')
        .send({
          userId: 'test-user',
          priceId: 'price_123',
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel'
        })
        .expect(200);

      expect(response.body).toHaveProperty('checkoutUrl');
      expect(response.body.checkoutUrl).toContain('stripe.com');
    });
  });

  describe('POST /api/webhooks/stripe', () => {
    it('should require stripe signature', async () => {
      const response = await request(app)
        .post('/api/webhooks/stripe')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle valid webhook events', async () => {
      // This is complex to test properly as it requires valid Stripe signatures
      // For now, we'll test the structure
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_123',
            subscription: 'sub_123'
          }
        }
      };

      // Mock Stripe webhook construction
      const mockStripe = require('stripe')();
      mockStripe.webhooks = {
        constructEvent: jest.fn().mockReturnValue(mockEvent)
      };

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'mock-signature')
        .send(JSON.stringify(mockEvent))
        .expect(200);

      expect(response.body).toHaveProperty('received', true);
    });
  });

  describe('POST /api/test/increment-usage', () => {
    it('should increment usage for testing', async () => {
      global.pricingService = {
        incrementUsage: jest.fn().mockResolvedValue({
          count: 5,
          limit: 100
        })
      };

      const response = await request(app)
        .post('/api/test/increment-usage')
        .send({
          userId: 'test-user',
          featureType: 'test-feature'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('usage');
      expect(global.pricingService.incrementUsage).toHaveBeenCalled();
    });
  });

  describe('POST /api/test/reset-usage', () => {
    it('should reset usage for testing', async () => {
      // Mock Firestore
      const mockFirestore = require('firebase-admin').firestore();
      const mockUpdate = jest.fn().mockResolvedValue();
      
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          update: mockUpdate
        })
      });

      const response = await request(app)
        .post('/api/test/reset-usage')
        .send({ userId: 'test-user' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(mockUpdate).toHaveBeenCalledWith({
        'usage.interviewReports.count': 0,
        'usage.voiceInterviews.count': 0,
        'usage.copilotChats.count': 0
      });
    });
  });
});