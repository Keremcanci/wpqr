const crypto = require('crypto')

const ALGO = 'aes-256-gcm'
const KEY_HEX = process.env.ENCRYPTION_KEY
if (!KEY_HEX) throw new Error('ENCRYPTION_KEY ortam değişkeni tanımlı değil')
const KEY = Buffer.from(KEY_HEX, 'hex')
if (KEY.length !== 32) throw new Error('ENCRYPTION_KEY 32 byte (64 hex karakter) olmalı')

const PREFIX = 'enc:v1:'

// DB'de at-rest şifreleme için. Zaten şifreli olmayan (eski/plaintext) değerleri
// decrypt() olduğu gibi geri döndürür — kademeli migrasyona izin verir.
function encrypt(plaintext) {
  if (plaintext == null) return plaintext
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + [iv, tag, encrypted].map(b => b.toString('base64')).join(':')
}

function decrypt(payload) {
  if (payload == null) return payload
  if (!payload.startsWith(PREFIX)) return payload
  const [ivB64, tagB64, dataB64] = payload.slice(PREFIX.length).split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

module.exports = { encrypt, decrypt }
