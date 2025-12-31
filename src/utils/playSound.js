import { execSync } from 'child_process';
import path from 'path';
import os from 'os';

/**
 * Plays a sound notification
 * @param {string} soundName - Name of the sound: 'notification', 'error', or 'applied'
 */
export function playSound(soundName = 'notification') {
  console.log(`DEBUG: playSound called with ${soundName}`);
  
  try {
    // Simplified sound options
    const sounds = {
      notification: '/System/Library/Sounds/Ping.aiff',     // General notifications
      error: '/System/Library/Sounds/Sosumi.aiff',          // Errors
      applied: '/System/Library/Sounds/Glass.aiff'          // Applications, counter-offers, rejections
    };

    // Map other sound types to these 3 main sounds
    const soundMap = {
      // Original mappings
      notification: 'notification',
      error: 'error',
      applied: 'applied',
      
      // Redirect these to the main 3 sounds
      success: 'notification',
      counterOffer: 'applied',
      lowPay: 'error',
      outsideHours: 'error',
      slotUnavailable: 'error'
    };

    // Get the mapped sound or default to notification
    const mappedSound = soundMap[soundName] || 'notification';
    const soundPath = sounds[mappedSound];
    
    console.log(`DEBUG: Will play ${mappedSound} sound using ${soundPath}`);
    
    if (os.platform() === 'darwin') {
      // macOS - Use execSync to make sure sound plays completely
      console.log(`DEBUG: Executing afplay ${soundPath}`);
      execSync(`afplay ${soundPath}`);
      console.log(`DEBUG: Sound played successfully`);
    } else if (os.platform() === 'win32') {
      // Windows - not implemented, would use PowerShell
      console.log('Sound playback not implemented for Windows');
    } else {
      // Linux - not implemented, would use aplay
      console.log('Sound playback not implemented for Linux');
    }
  } catch (error) {
    console.error('Error playing sound:', error.message);
  }
}

export default playSound; 