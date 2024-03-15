import { Type, Static } from '@sinclair/typebox'
import { KeyPairSchema } from './keypair.js'
import { APActor } from 'activitypub-types'

export const ActorInfoSchema = Type.Object({
  // The actor for the domain inbox
  actorUrl: Type.String(),
  publicKeyId: Type.String(),
  keypair: KeyPairSchema,
  announce: Type.Boolean({ default: false })
})

export type ActorInfo = Static<typeof ActorInfoSchema>

export type APActorNonStandard = APActor & {
  publicKey: {
    id: string
    owner: string
    publicKeyPem: string
  }
}
