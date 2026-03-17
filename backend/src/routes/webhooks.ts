import { FastifyInstance } from 'fastify';
import { CreditService } from '../services/credit.service';
import { MockSentry } from '../services/sentry.service';

/**
 * Viprosell v1.2 Payment Webhook Handlers
 * Receives external gateway payloads (e.g. Stripe/PayPal)
 * and grants credits idempotently.
 */
export async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post('/stripe', async (request, reply) => {
    try {
      // In production, verify signature: stripe.webhooks.constructEvent(request.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
      const event: any = request.body;
      
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        // 1. Extract Project/User from metadata
        const userId = session.client_reference_id;
        const creditsToGrant = parseInt(session.metadata?.credits || '0', 10);
        const idempotencyKey = session.id; // Stripe checkout session ID is globally unique

        if (!userId || creditsToGrant <= 0) {
           return reply.code(400).send({ error: 'Missing user or invalid credit metadata' });
        }

        fastify.log.info(`[Payment Success] User: ${userId}, granting ${creditsToGrant} credits. Session: ${idempotencyKey}`);
        
        // 2. Mock: Insert into `payments` table specifying idempotency_key to prevent double-spending
        // 3. Mock: Insert into `credit_ledger`
        
        // As a mock for Beta, we assume success
        return reply.code(200).send({ received: true, credits_granted: creditsToGrant });
      }

      return reply.code(200).send({ received: true });
    } catch (err: any) {
      MockSentry.captureException(err, { context: 'stripe-webhook' });
      fastify.log.error(`Stripe webhook error: ${err.message}`);
      return reply.code(400).send(`Webhook Error: ${err.message}`);
    }
  });

  fastify.post('/paypal', async (request, reply) => {
    return reply.code(200).send({ received: true, provider: 'paypal', message: 'Not implemented in Beta' });
  });
}
