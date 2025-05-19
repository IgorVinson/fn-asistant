import playSound from './utils/playSound.js';

console.log('Testing simplified sound system...');

// Test all three main sounds
console.log('1. notification - General notifications:');
playSound('notification');

console.log('2. error - Rejections and errors:');
playSound('error');

console.log('3. applied - Applications and counter-offers:');
playSound('applied');

// Test that other sound types are correctly mapped
console.log('Testing that other sound types map to main ones:');
console.log('counterOffer → applied:');
playSound('counterOffer');

console.log('lowPay → error:');
playSound('lowPay');

console.log('Sound test completed!'); 