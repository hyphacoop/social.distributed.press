import { generateKeyPairSync } from 'node:crypto'

export interface KeyPair {
  publicKeyPem: string
  privateKeyPem: string
}

export default function generateIdentity (): KeyPair {
  const {
    publicKey,
    privateKey
  } = generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  })

  return {
    publicKeyPem: publicKey,
    privateKeyPem: privateKey
  }
}
