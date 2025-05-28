import playSound from './utils/playSound.js';

console.log('Testing updated playSound function...');

// Test each sound
playSound('notification');
playSound('success');
playSound('error');
playSound('applied');
playSound('counterOffer');
playSound('lowPay');
playSound('outsideHours');
playSound('slotUnavailable');

console.log('All sounds played. Test complete!'); 