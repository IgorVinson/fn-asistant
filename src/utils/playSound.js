import { execSync } from 'child_process';
import os from 'os';

/**
 * Plays a sound notification
 * @param {string} soundName - Name of the sound: 'notification', 'error', or 'applied'
 */
export function playSound(soundName = 'notification') {
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
    
    if (os.platform() === 'darwin') {
      // macOS - Use execSync to make sure sound plays completely
      execSync(`afplay ${soundPath}`);
    } else if (os.platform() === 'win32') {
      // Windows - not implemented, would use PowerShell
    } else {
      // Linux - not implemented, would use aplay
    }
  } catch (error) {
    console.error('Error playing sound:', error.message);
  }
}

export default playSound;