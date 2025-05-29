import { getWMorderData } from './utils/WorkMarket/getWMorderData.js';

async function testOrderData(workOrderId) {
  console.log(`🧪 Testing WorkMarket order data retrieval for ID: ${workOrderId}`);
  console.log('=' .repeat(60));
  
  try {
    // Construct the WorkMarket URL from the ID
    const workMarketUrl = `https://www.workmarket.com/assignments/details/${workOrderId}`;
    
    console.log(`📋 Fetching data from: ${workMarketUrl}`);
    console.log('⏳ Please wait...\n');
    
    const orderData = await getWMorderData(workMarketUrl);
    
    if (orderData) {
      console.log('✅ Order data retrieved successfully:');
      console.log('=' .repeat(60));
      console.log(`ID: ${orderData.id}`);
      console.log(`Platform: ${orderData.platform}`);
      console.log(`Company: ${orderData.company}`);
      console.log(`Title: ${orderData.title}`);
      console.log(`Hourly Rate: $${orderData.hourlyRate}`);
      console.log(`Hours of Work: ${orderData.hoursOfWork}`);
      console.log(`Total Payment: $${orderData.totalPayment}`);
      console.log(`Date: ${orderData.date}`);
      console.log(`Time: ${orderData.time}`);
      console.log(`Distance: ${orderData.distance} miles`);
      console.log('=' .repeat(60));
    } else {
      console.log('❌ Failed to retrieve order data');
    }
  } catch (error) {
    console.error('❌ Error during test:', error.message);
  }
}

// Get work order ID from command line arguments
const workOrderId = process.argv[2];

if (!workOrderId) {
  console.log('Usage: node test-order-data.js <work-order-id>');
  console.log('Example: node test-order-data.js 12345678');
  process.exit(1);
}

// Validate that the ID is numeric
if (!/^\d+$/.test(workOrderId)) {
  console.log('❌ Error: Work order ID must be numeric');
  process.exit(1);
}

testOrderData(workOrderId);
