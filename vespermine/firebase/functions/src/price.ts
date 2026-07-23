import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const db = admin.firestore();

/**
 * Scheduled function to update Bitcoin price every 5 minutes
 * Fetches from CoinGecko API and stores in Firestore
 */
export const updateBitcoinPrice = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price',
        {
          params: {
            ids: 'bitcoin',
            vs_currencies: 'usd',
            include_24hr_change: 'true',
          },
        }
      );
      
      const price = response.data.bitcoin.usd;
      const change24h = response.data.bitcoin.usd_24h_change;
      
      // Store current price
      await db.collection('config').doc('bitcoin_price').set({
        price,
        change24h: change24h,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'coingecko',
      });
      
      // Store in price history for charts
      await db.collection('config').doc('bitcoin_price')
        .collection('history').add({
          price,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      
      functions.logger.info(`BTC price updated: $${price} (${change24h?.toFixed(2)}%)`);
      
    } catch (error) {
      functions.logger.error('Failed to fetch Bitcoin price', error);
      // Don't throw - we want the function to retry but not crash
    }
  });

/**
 * HTTP endpoint to get current Bitcoin price
 * Can be called from the app for real-time updates
 */
export const getBitcoinPrice = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');
  
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }
  
  try {
    const priceDoc = await db.collection('config').doc('bitcoin_price').get();
    
    if (!priceDoc.exists) {
      // Fallback: fetch directly from CoinGecko
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price',
        {
          params: {
            ids: 'bitcoin',
            vs_currencies: 'usd',
            include_24hr_change: 'true',
          },
        }
      );
      
      res.json({
        price: response.data.bitcoin.usd,
        change24h: response.data.bitcoin.usd_24h_change,
        source: 'coingecko',
        cached: false,
      });
      return;
    }
    
    const data = priceDoc.data()!;
    res.json({
      price: data.price,
      change24h: data.change24h,
      updatedAt: data.updatedAt,
      source: data.source,
      cached: true,
    });
    
  } catch (error) {
    functions.logger.error('Error fetching price', error);
    res.status(500).json({ error: 'Failed to fetch price' });
  }
});
