import { Type, Static } from '@sinclair/typebox'
import { generateKeyPairSync } from 'node:crypto'
import { Sha256Signer } from 'activitypub-http-signatures'

export const KeyPairSchema = Type.Object({
  publicKeyPem: Type.String(),
  privateKeyPem: Type.String()
})

export type KeyPair = Static<typeof KeyPairSchema>

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

export function makeSigner (keypair: KeyPair, publicKeyId: string, headerNames?: string[]): Sha256Signer {
  const {
    privateKeyPem: privateKey
  } = keypair

  const signer = new Sha256Signer({ publicKeyId, privateKey, headerNames })
  return signer
}
