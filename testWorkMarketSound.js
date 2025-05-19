import playSound from './utils/playSound.js';

console.log('Testing sound playback for WorkMarket order rejection');

// Simulate the low-pay WorkMarket case
console.log('Simulating WorkMarket order with low pay and low distance');
console.log('This should hit the final else block in index.js');

playSound('error');

console.log('Test completed. Did you hear the error sound?'); 