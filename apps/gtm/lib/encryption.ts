import CryptoJS from 'crypto-js'

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_SECRET
  if (!key) {
    throw new Error(
      'ENCRYPTION_SECRET is required for secure token storage. ' +
      'Generate a random 32+ character string and add it to .env.local'
    )
  }
  return key
}

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, getEncryptionKey()).toString()
}

export function decrypt(encryptedText: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedText, getEncryptionKey())
  return bytes.toString(CryptoJS.enc.Utf8)
}
