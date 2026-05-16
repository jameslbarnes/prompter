const admin = require('firebase-admin');

// Interview bundle pricing
const INTERVIEW_PRICING = {
  single: { 
    id: 'single',
    quantity: 1, 
    price: 1.00, 
    unitPrice: 1.00,
    name: 'Single Interview',
    description: '1 additional interview'
  },
  bulk_50: { 
    id: 'bulk_50',
    quantity: 50, 
    price: 47.50, 
    unitPrice: 0.95,
    name: '50 Interview Bundle',
    description: '50 interviews (5% off)'
  },
  bulk_100: { 
    id: 'bulk_100',
    quantity: 100, 
    price: 90.00, 
    unitPrice: 0.90,
    name: '100 Interview Bundle', 
    description: '100 interviews (10% off)'
  },
  bulk_500: { 
    id: 'bulk_500',
    quantity: 500, 
    price: 425.00, 
    unitPrice: 0.85,
    name: '500 Interview Bundle',
    description: '500 interviews (15% off)'
  }
};

// Pricing plans configuration
const PRICING_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 24.99,
    currency: 'usd',
    interval: 'month',
    includedInterviews: 25,
    features: {
      memoryService: false,
      webSearch: false,
      thinkingToggle: false,
      followupModelSelector: false,
      customBranding: false
    },
    stripeProductId: process.env.STRIPE_STARTER_PRODUCT_ID,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 59.99,
    currency: 'usd',
    interval: 'month',
    includedInterviews: 50,  // Updated to 50
    features: {
      memoryService: true,
      webSearch: true,
      thinkingToggle: false,
      followupModelSelector: false,
      customBranding: true
    },
    stripeProductId: process.env.STRIPE_GROWTH_PRODUCT_ID,
    stripePriceId: process.env.STRIPE_GROWTH_PRICE_ID
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 149,
    currency: 'usd',
    interval: 'month',
    includedInterviews: 10000,
    features: {
      memoryService: true,
      webSearch: true,
      thinkingToggle: false,
      followupModelSelector: false,
      customBranding: true
    },
    stripeProductId: process.env.STRIPE_TEAM_PRODUCT_ID,
    stripePriceId: process.env.STRIPE_TEAM_PRICE_ID
  }
};

const FREE_TRIAL_INTERVIEWS = 3; // Free trial limit (lifetime, non-renewing)

class PricingService {
  constructor(db, stripe) {
    this.db = db;
    this.stripe = stripe;
  }

  /**
   * Get user's current subscription and usage
   */
  async getUserSubscription(userId) {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        // Create new user with free trial
        const newUserData = {
          subscription: {
            plan: 'free',
            status: 'active',
            currentPeriodStart: admin.firestore.FieldValue.serverTimestamp(),
            currentPeriodEnd: null,
            stripeCustomerId: null,
            stripeSubscriptionId: null
          },
          usage: {
            interviewsCompleted: 0,
            currentPeriodUsage: 0,
            lastResetDate: admin.firestore.FieldValue.serverTimestamp(),
            purchasedInterviews: 0,
            purchasedInterviewsUsed: 0,
            lifetimePurchasedTotal: 0
          },
          interviewPurchases: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await this.db.collection('users').doc(userId).set(newUserData, { merge: true });
        return newUserData;
      }
      
      const userData = userDoc.data();
      
      // Ensure subscription object exists and has proper structure
      if (!userData.subscription || !userData.subscription.plan) {
        console.log(`[getUserSubscription] User ${userId} missing subscription data, setting to free trial`);
        const subscriptionUpdate = {
          'subscription.plan': 'free',
          'subscription.status': 'active',
          'subscription.currentPeriodStart': admin.firestore.FieldValue.serverTimestamp(),
          'subscription.currentPeriodEnd': null,
          'subscription.stripeCustomerId': null,
          'subscription.stripeSubscriptionId': null
        };
        
        // Also ensure usage object exists
        if (!userData.usage) {
          subscriptionUpdate['usage.interviewsCompleted'] = 0;
          subscriptionUpdate['usage.currentPeriodUsage'] = 0;
          subscriptionUpdate['usage.lastResetDate'] = admin.firestore.FieldValue.serverTimestamp();
        }
        
        await this.db.collection('users').doc(userId).update(subscriptionUpdate);
        
        // Return updated data
        const updatedDoc = await this.db.collection('users').doc(userId).get();
        return updatedDoc.data();
      }
      
      return userData;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      throw error;
    }
  }

  /**
   * Check if user can complete another interview
   */
  async canCompleteInterview(userId) {
    try {
      const userData = await this.getUserSubscription(userId);
      const subscription = userData.subscription || {};
      const usage = userData.usage || {};

      console.log(`[canCompleteInterview] User ID: ${userId}`);
      console.log(`[canCompleteInterview] Subscription plan: ${subscription.plan}`);
      console.log(`[canCompleteInterview] Usage data:`, usage);
      console.log(`[canCompleteInterview] FREE_TRIAL_INTERVIEWS limit: ${FREE_TRIAL_INTERVIEWS}`);

      // Free trial users get 3 lifetime interviews (non-renewing)
      if (subscription.plan === 'free') {
        const canComplete = usage.interviewsCompleted < FREE_TRIAL_INTERVIEWS;
        console.log(`[canCompleteInterview] Free trial check: ${usage.interviewsCompleted} < ${FREE_TRIAL_INTERVIEWS} = ${canComplete}`);
        return canComplete;
      }

      // Paid plan users
      const plan = PRICING_PLANS[subscription.plan];
      if (!plan) {
        console.log(`[canCompleteInterview] Unknown plan: ${subscription.plan}`);
        return false; // Unknown plan
      }

      // First check plan interviews
      if (usage.currentPeriodUsage < plan.includedInterviews) {
        console.log(`[canCompleteInterview] Can use plan interviews: ${usage.currentPeriodUsage} < ${plan.includedInterviews}`);
        return true;
      }

      // Then check purchased interviews
      const purchasedRemaining = (usage.purchasedInterviews || 0) - (usage.purchasedInterviewsUsed || 0);
      const canComplete = purchasedRemaining >= 1;
      console.log(`[canCompleteInterview] Purchased check: ${purchasedRemaining} remaining >= 1 required = ${canComplete}`);
      return canComplete;
    } catch (error) {
      console.error('Error checking interview limit:', error);
      return false;
    }
  }

  /**
   * Increment interview completion count
   */
  async incrementInterviewUsage(userId) {
    try {
      const userRef = this.db.collection('users').doc(userId);
      
      await this.db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          throw new Error('User not found');
        }
        
        const userData = userDoc.data();
        const usage = userData.usage || {};
        const subscription = userData.subscription || {};
        
        // Get plan details
        const plan = PRICING_PLANS[subscription.plan];
        const planLimit = plan ? plan.includedInterviews : 0;
        
        // Determine if we're using plan interviews or purchased interviews
        let usePurchased = false;
        if (subscription.plan !== 'free') {
          // For paid plans, use purchased interviews if plan interviews are exhausted
          if (usage.currentPeriodUsage >= planLimit) {
            usePurchased = true;
          }
        }
        
        const updateData = {
          'usage.interviewsCompleted': admin.firestore.FieldValue.increment(1),
          'usage.lastUsageDate': admin.firestore.FieldValue.serverTimestamp()
        };
        
        if (usePurchased) {
          // Deduct from purchased interviews
          updateData['usage.purchasedInterviewsUsed'] = admin.firestore.FieldValue.increment(1);
          console.log(`[incrementInterviewUsage] Using purchased interview`);
        } else {
          // Deduct from plan interviews
          updateData['usage.currentPeriodUsage'] = admin.firestore.FieldValue.increment(1);
          console.log(`[incrementInterviewUsage] Using plan interview`);
        }
        
        transaction.update(userRef, updateData);
      });
      
      console.log(`Incremented interview usage for user ${userId}`);
    } catch (error) {
      console.error('Error incrementing interview usage:', error);
      throw error;
    }
  }

  /**
   * Create Stripe customer
   */
  async createStripeCustomer(userId, email, name) {
    try {
      const customer = await this.stripe.customers.create({
        email: email,
        name: name,
        metadata: {
          userId: userId
        }
      });

      // Update user document with Stripe customer ID
      await this.db.collection('users').doc(userId).update({
        'subscription.stripeCustomerId': customer.id
      });

      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Create subscription checkout session
   */
  async createCheckoutSession(userId, planId, successUrl, cancelUrl) {
    try {
      console.log('[PricingService] createCheckoutSession called with:', { userId, planId });
      
      const plan = PRICING_PLANS[planId];
      if (!plan) {
        console.error('[PricingService] Invalid plan ID:', planId);
        console.log('[PricingService] Available plans:', Object.keys(PRICING_PLANS));
        throw new Error('Invalid plan ID');
      }
      
      console.log('[PricingService] Plan found:', { 
        id: plan.id, 
        stripePriceId: plan.stripePriceId,
        stripeProductId: plan.stripeProductId 
      });

      const userData = await this.getUserSubscription(userId);
      let customerId = userData.subscription?.stripeCustomerId;

      // Create customer if doesn't exist
      if (!customerId) {
        const userAuth = await admin.auth().getUser(userId);
        const customer = await this.createStripeCustomer(
          userId, 
          userAuth.email, 
          userAuth.displayName || userAuth.email
        );
        customerId = customer.id;
      }

      console.log('[PricingService] Creating Stripe checkout session with:', {
        customerId,
        priceId: plan.stripePriceId,
        planId: planId
      });
      
      if (!plan.stripePriceId) {
        throw new Error(`Stripe price ID not configured for plan: ${planId}`);
      }
      
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price: plan.stripePriceId,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: userId,
          planId: planId
        }
      });

      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Handle successful subscription
   */
  async handleSubscriptionSuccess(stripeSubscriptionId, customerId, planId) {
    try {
      // Find user by Stripe customer ID
      const usersSnapshot = await this.db.collection('users')
        .where('subscription.stripeCustomerId', '==', customerId)
        .limit(1)
        .get();

      if (usersSnapshot.empty) {
        throw new Error('User not found for customer ID: ' + customerId);
      }

      const userDoc = usersSnapshot.docs[0];
      const userId = userDoc.id;

      // Get subscription details from Stripe
      const subscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);

      // Update user subscription
      await this.db.collection('users').doc(userId).update({
        'subscription.plan': planId,
        'subscription.status': subscription.status,
        'subscription.stripeSubscriptionId': stripeSubscriptionId,
        'subscription.currentPeriodStart': admin.firestore.Timestamp.fromDate(
          new Date(subscription.current_period_start * 1000)
        ),
        'subscription.currentPeriodEnd': admin.firestore.Timestamp.fromDate(
          new Date(subscription.current_period_end * 1000)
        ),
        'usage.currentPeriodUsage': 0, // Reset usage for new billing period
        'usage.lastResetDate': admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Updated subscription for user ${userId} to plan ${planId}`);
    } catch (error) {
      console.error('Error handling subscription success:', error);
      throw error;
    }
  }

  /**
   * Handle subscription cancellation
   */
  async handleSubscriptionCancellation(stripeSubscriptionId) {
    try {
      const usersSnapshot = await this.db.collection('users')
        .where('subscription.stripeSubscriptionId', '==', stripeSubscriptionId)
        .limit(1)
        .get();

      if (usersSnapshot.empty) {
        console.warn('User not found for subscription ID: ' + stripeSubscriptionId);
        return;
      }

      const userDoc = usersSnapshot.docs[0];
      const userId = userDoc.id;

      await this.db.collection('users').doc(userId).update({
        'subscription.status': 'canceled',
        'subscription.canceledAt': admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Canceled subscription for user ${userId}`);
    } catch (error) {
      console.error('Error handling subscription cancellation:', error);
      throw error;
    }
  }

  /**
   * Get pricing plans
   */
  getPricingPlans() {
    return PRICING_PLANS;
  }

  /**
   * Get free trial limit
   */
  getFreeTrialLimit() {
    return FREE_TRIAL_INTERVIEWS;
  }

  /**
   * Check if user has access to a specific feature
   */
  async hasFeatureAccess(userId, featureName) {
    try {
      const userData = await this.getUserSubscription(userId);
      const subscription = userData.subscription || {};
      
      // Check if user is super-admin
      if (subscription.isSuperAdmin) {
        return true;
      }

      // Free users don't have access to premium features
      if (subscription.plan === 'free') {
        return false;
      }

      // Check plan features
      const plan = PRICING_PLANS[subscription.plan];
      if (!plan) {
        return false;
      }

      return plan.features[featureName] || false;
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  /**
   * Get user's feature permissions
   */
  async getUserFeatures(userId) {
    try {
      const userData = await this.getUserSubscription(userId);
      const subscription = userData.subscription || {};
      
      // Super-admin has all features
      if (subscription.isSuperAdmin) {
        return {
          memoryService: true,
          webSearch: true,
          thinkingToggle: true,
          followupModelSelector: true,
          customBranding: true,
          isSuperAdmin: true
        };
      }

      // Free users have no premium features
      if (subscription.plan === 'free') {
        return {
          memoryService: false,
          webSearch: false,
          thinkingToggle: false,
          followupModelSelector: false,
          customBranding: false,
          isSuperAdmin: false
        };
      }

      // Get features from plan
      const plan = PRICING_PLANS[subscription.plan];
      if (!plan) {
        return {
          memoryService: false,
          webSearch: false,
          thinkingToggle: false,
          followupModelSelector: false,
          customBranding: false,
          isSuperAdmin: false
        };
      }

      return {
        ...plan.features,
        isSuperAdmin: false
      };
    } catch (error) {
      console.error('Error getting user features:', error);
      return {
        memoryService: false,
        webSearch: false,
        thinkingToggle: false,
        followupModelSelector: false,
        customBranding: false,
        isSuperAdmin: false
      };
    }
  }


  /**
   * Get pricing plans
   */
  getPricingPlans() {
    return PRICING_PLANS;
  }

  /**
   * Get free trial limit
   */
  getFreeTrialLimit() {
    return FREE_TRIAL_INTERVIEWS;
  }

  /**
   * Reset usage for billing period (called by cron job)
   */
  async resetUsageForBillingPeriod() {
    try {
      const now = new Date();
      const usersSnapshot = await this.db.collection('users')
        .where('subscription.plan', '!=', 'free')
        .get();

      const batch = this.db.batch();
      let resetCount = 0;

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const subscription = userData.subscription || {};
        
        if (subscription.currentPeriodEnd) {
          const periodEnd = subscription.currentPeriodEnd.toDate();
          
          // If current period has ended, reset usage
          if (now > periodEnd) {
            batch.update(doc.ref, {
              'usage.currentPeriodUsage': 0,
              'usage.lastResetDate': admin.firestore.FieldValue.serverTimestamp()
            });
            resetCount++;
          }
        }
      });

      if (resetCount > 0) {
        await batch.commit();
        console.log(`Reset usage for ${resetCount} users`);
      }
    } catch (error) {
      console.error('Error resetting usage for billing period:', error);
      throw error;
    }
  }

  /**
   * Get user's interview balance
   */
  async getInterviewBalance(userId) {
    try {
      const userData = await this.getUserSubscription(userId);
      const subscription = userData.subscription || {};
      const usage = userData.usage || {};
      
      let planInterviewsRemaining = 0;
      let purchasedInterviewsRemaining = (usage.purchasedInterviews || 0) - (usage.purchasedInterviewsUsed || 0);
      
      if (subscription.plan === 'free') {
        planInterviewsRemaining = Math.max(0, FREE_TRIAL_INTERVIEWS - usage.interviewsCompleted);
      } else {
        const plan = PRICING_PLANS[subscription.plan];
        if (plan) {
          planInterviewsRemaining = Math.max(0, plan.includedInterviews - usage.currentPeriodUsage);
        }
      }
      
      return {
        planInterviewsRemaining,
        purchasedInterviewsRemaining,
        totalRemaining: planInterviewsRemaining + purchasedInterviewsRemaining
      };
    } catch (error) {
      console.error('Error getting interview balance:', error);
      throw error;
    }
  }

  /**
   * Create checkout session for interview purchase
   */
  async createInterviewPurchaseSession(userId, bundleType, successUrl, cancelUrl) {
    try {
      const bundle = INTERVIEW_PRICING[bundleType];
      if (!bundle) {
        throw new Error('Invalid bundle type');
      }
      
      const userData = await this.getUserSubscription(userId);
      
      // Check if user has an active paid subscription
      if (!userData.subscription || userData.subscription.plan === 'free') {
        throw new Error('Additional interviews are only available for paid plan subscribers');
      }
      
      let customerId = userData.subscription?.stripeCustomerId;
      
      // Create customer if doesn't exist
      if (!customerId) {
        const userAuth = await admin.auth().getUser(userId);
        const customer = await this.createStripeCustomer(
          userId, 
          userAuth.email, 
          userAuth.displayName || userAuth.email
        );
        customerId = customer.id;
      }
      
      // Create one-time payment session
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: bundle.name,
              description: bundle.description
            },
            unit_amount: Math.round(bundle.price * 100), // Convert to cents
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: userId,
          bundleType: bundleType,
          interviewQuantity: bundle.quantity.toString()
        }
      });
      
      return session;
    } catch (error) {
      console.error('Error creating interview purchase session:', error);
      throw error;
    }
  }

  /**
   * Handle successful interview purchase
   */
  async handleInterviewPurchase(sessionId) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status !== 'paid') {
        throw new Error('Payment not completed');
      }
      
      const { userId, bundleType, interviewQuantity } = session.metadata;
      const bundle = INTERVIEW_PRICING[bundleType];
      
      if (!bundle) {
        throw new Error('Invalid bundle type in metadata');
      }
      
      // Update user's purchased interviews
      const userRef = this.db.collection('users').doc(userId);
      
      await this.db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          throw new Error('User not found');
        }
        
        const updates = {
          'usage.purchasedInterviews': admin.firestore.FieldValue.increment(parseInt(interviewQuantity)),
          'usage.lifetimePurchasedTotal': admin.firestore.FieldValue.increment(bundle.price)
        };
        
        transaction.update(userRef, updates);
        
        // Add purchase record
        const purchaseRecord = {
          purchaseId: session.id,
          quantity: bundle.quantity,
          unitPrice: bundle.unitPrice,
          totalPrice: bundle.price,
          purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
          stripeSessionId: session.id,
          bundleType: bundleType
        };
        
        transaction.update(userRef, {
          interviewPurchases: admin.firestore.FieldValue.arrayUnion(purchaseRecord)
        });
      });
      
      console.log(`Successfully processed interview purchase for user ${userId}: ${bundle.quantity} interviews`);
      
      return {
        userId,
        quantity: bundle.quantity,
        totalPrice: bundle.price
      };
    } catch (error) {
      console.error('Error handling interview purchase:', error);
      throw error;
    }
  }

  /**
   * Get interview pricing options
   */
  getInterviewPricing() {
    return INTERVIEW_PRICING;
  }
}

module.exports = { PricingService, PRICING_PLANS, FREE_TRIAL_INTERVIEWS, INTERVIEW_PRICING }; 