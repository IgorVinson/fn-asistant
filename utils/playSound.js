import { execSync } from 'child_process';
import path from 'path';
import os from 'os';
import logger from './logger.js';

/**
 * Plays a sound notification
 * @param {string} soundName - Name of the sound: 'notification', 'error', or 'applied'
 */
export function playSound(soundName = 'notification') {
  logger.debug(`playSound called with ${soundName}`);

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
    
    logger.debug(`Will play ${mappedSound} sound using ${soundPath}`);

    if (os.platform() === 'darwin') {
      // macOS - Use execSync to make sure sound plays completely
      logger.debug(`Executing afplay ${soundPath}`);
      execSync(`afplay ${soundPath}`);
      logger.debug(`Sound played successfully`);
    } else if (os.platform() === 'win32') {
      // Windows - not implemented, would use PowerShell
      logger.debug('Sound playback not implemented for Windows');
    } else {
      // Linux - not implemented, would use aplay
      logger.debug('Sound playback not implemented for Linux');
    }
  } catch (error) {
    logger.error(`Error playing sound: ${error.message}`);
  }
}

export default playSound; 