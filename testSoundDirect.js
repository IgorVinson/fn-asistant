import { execSync } from 'child_process';

console.log('Testing direct sound playback...');

try {
  // Use execSync to make sure it completes before moving on
  console.log('Playing Ping sound...');
  execSync('afplay /System/Library/Sounds/Ping.aiff');
  
  console.log('Playing Sosumi sound...');
  execSync('afplay /System/Library/Sounds/Sosumi.aiff');
  
  console.log('Playing Glass sound...');
  execSync('afplay /System/Library/Sounds/Glass.aiff');
  
  console.log('Sound test completed successfully!');
} catch (error) {
  console.error('Error playing sound:', error.message);
} 