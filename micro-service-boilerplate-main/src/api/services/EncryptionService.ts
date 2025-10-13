import crypto from 'crypto';

/**
 * Encryption Service for securing PII data and chat messages
 * Uses AES-256-CBC for encryption
 */
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly encryptionKey: Buffer;

  constructor() {
    // In production, this should come from environment variables
    // Key should be 32 bytes (256 bits) for AES-256
    const keyEnv = process.env.ENCRYPTION_KEY;

    if (keyEnv) {
      // Check if it's base64 encoded (common in production)
      try {
        const decodedKey = Buffer.from(keyEnv, 'base64');
        if (decodedKey.length === 32) {
          this.encryptionKey = decodedKey;
          console.log('✅ Using base64-encoded encryption key (32 bytes)');
        } else {
          // Try as plain text
          if (keyEnv.length === 32) {
            this.encryptionKey = Buffer.from(keyEnv, 'utf8');
            console.log('✅ Using plain text encryption key (32 characters)');
          } else {
            throw new Error(
              `Encryption key must be exactly 32 bytes. Decoded length: ${decodedKey.length}, Plain length: ${keyEnv.length}`
            );
          }
        }
      } catch (error) {
        // If base64 decode fails, try as plain text
        if (keyEnv.length === 32) {
          this.encryptionKey = Buffer.from(keyEnv, 'utf8');
          console.log('✅ Using plain text encryption key (32 characters)');
        } else {
          throw new Error(
            `Encryption key must be exactly 32 characters (plain text) or 32 bytes (base64 encoded). Current length: ${keyEnv.length}`
          );
        }
      }
    } else {
      // Use default key for development
      console.warn('⚠️  Using default encryption key. Set ENCRYPTION_KEY environment variable for production!');
      this.encryptionKey = Buffer.from('dev-encryption-key-32-chars!!', 'utf8');
    }
  }

  /**
   * Encrypt a message using AES-256-CBC
   * @param plainText - The text to encrypt
   * @returns Object containing encrypted text and IV
   */
  public encryptMessage(plainText: string): { encryptedContent: string; iv: string } {
    try {
      // Generate a random initialization vector (IV)
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      // Encrypt the message
      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        encryptedContent: encrypted,
        iv: iv.toString('hex')
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  /**
   * Decrypt a message using AES-256-CBC
   * @param encryptedContent - The encrypted text
   * @param ivHex - The initialization vector in hex format
   * @returns Decrypted plain text
   */
  public decryptMessage(encryptedContent: string, ivHex: string): string {
    try {
      const iv = Buffer.from(ivHex, 'hex');

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);

      // Decrypt the message
      let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  /**
   * Encrypt PII data (email, phone, etc.)
   * @param data - The sensitive data to encrypt
   * @returns Encrypted data with IV
   */
  public encryptPII(data: string): { encryptedContent: string; iv: string } {
    return this.encryptMessage(data);
  }

  /**
   * Decrypt PII data
   * @param encrypted - The encrypted data
   * @param iv - The initialization vector
   * @returns Decrypted data
   */
  public decryptPII(encrypted: string, iv: string): string {
    return this.decryptMessage(encrypted, iv);
  }

  /**
   * Hash sensitive data (one-way, for comparison only)
   * Useful for email/username lookup without storing plain text
   * @param data - Data to hash
   * @returns SHA-256 hash
   */
  public hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate a secure random token (for QR codes, invite links, etc.)
   * @param length - Length of the token (default: 32)
   * @returns Random hex token
   */
  public generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a user-friendly referral code
   * Format: XXX-XXX-XXX (9 characters, uppercase letters and numbers)
   * @returns Referral code
   */
  public generateReferralCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (I, O, 0, 1)
    let code = '';

    for (let i = 0; i < 9; i++) {
      if (i > 0 && i % 3 === 0) {
        code += '-';
      }
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
  }

  /**
   * Encrypt a JSON object
   * @param obj - Object to encrypt
   * @returns Encrypted string with IV
   */
  public encryptObject(obj: any): { encryptedContent: string; iv: string } {
    const jsonString = JSON.stringify(obj);
    return this.encryptMessage(jsonString);
  }

  /**
   * Decrypt a JSON object
   * @param encryptedContent - Encrypted content
   * @param iv - Initialization vector
   * @returns Decrypted object
   */
  public decryptObject(encryptedContent: string, iv: string): any {
    const jsonString = this.decryptMessage(encryptedContent, iv);
    return JSON.parse(jsonString);
  }

  /**
   * Create a preview of encrypted content (for display purposes)
   * Shows first 50 characters of decrypted content
   * @param encryptedContent - Encrypted content
   * @param iv - Initialization vector
   * @returns Preview string
   */
  public createPreview(encryptedContent: string, iv: string): string {
    try {
      const decrypted = this.decryptMessage(encryptedContent, iv);
      return decrypted.length > 50 ? decrypted.substring(0, 50) + '...' : decrypted;
    } catch (error) {
      return '[Unable to preview]';
    }
  }

  /**
   * Validate encryption key strength
   * @returns Boolean indicating if key is strong enough
   */
  public validateKeyStrength(): boolean {
    const devKey = Buffer.from('dev-encryption-key-32-chars!!', 'utf8');
    return this.encryptionKey.length === 32 && !this.encryptionKey.equals(devKey);
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();
