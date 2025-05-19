import playSound from './utils/playSound.js';

console.log('Starting sound test...');

// Helper function to play a sound and wait
const playSoundWithDelay = (sound, delay) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`Playing "${sound}" sound...`);
      playSound(sound);
      resolve();
    }, delay);
  });
};

// Test all sounds with a 2-second delay between each
async function testAllSounds() {
  console.log('🔊 Testing notification sound');
  playSound('notification');
  
  await playSoundWithDelay('success', 2000);
  await playSoundWithDelay('error', 2000);
  await playSoundWithDelay('applied', 2000);
  await playSoundWithDelay('counterOffer', 2000);
  
  // List all available system sounds on macOS
  console.log('\nAvailable macOS system sounds (in /System/Library/Sounds/):');
  console.log('- Basso.aiff');
  console.log('- Blow.aiff');
  console.log('- Bottle.aiff (success)');
  console.log('- Frog.aiff');
  console.log('- Funk.aiff');
  console.log('- Glass.aiff (applied)');
  console.log('- Hero.aiff');
  console.log('- Morse.aiff');
  console.log('- Ping.aiff (notification)');
  console.log('- Pop.aiff');
  console.log('- Purr.aiff');
  console.log('- Sosumi.aiff (error)');
  console.log('- Submarine.aiff (counterOffer)');
  console.log('- Tink.aiff');
  
  console.log('\nTest completed!');
}

testAllSounds(); 