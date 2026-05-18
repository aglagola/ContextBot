const express = require('express');
const Stripe = require('stripe');
const { verifyToken } = require('../middleware/auth');
const db = require('../db/database');

const router = express.Router();
// Initialize Stripe lazily so it doesn't crash if env var isn't set during tests
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

// 1. Upgrade - Create Checkout Session
router.post('/upgrade', verifyToken, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID,
          quantity: 1,
        },
      ],
      client_reference_id: req.user.id.toString(), // Connect session to user
      customer_email: req.user.email,
      success_url: `${process.env.ALLOWED_ORIGIN || 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.ALLOWED_ORIGIN || 'http://localhost:3000'}/cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe session creation error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// 2. Webhook - Handle Stripe events (must use raw body)
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!stripe) {
    return res.status(500).end();
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        const userId = session.client_reference_id;
        if (userId) {
          db.prepare('UPDATE users SET tier = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?')
            .run('pro', session.customer, session.subscription, userId);
        }
        break;
      case 'customer.subscription.deleted':
      case 'customer.subscription.canceled':
        const subscription = event.data.object;
        db.prepare('UPDATE users SET tier = ?, stripe_subscription_id = NULL WHERE stripe_customer_id = ?')
          .run('free', subscription.customer);
        break;
      // You can handle other events like payment failures here
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.send();
  } catch (error) {
    console.error('Database update error in webhook:', error);
    res.status(500).send('Internal Server Error updating database');
  }
});

module.exports = router;
