import { Type, Static } from '@sinclair/typebox'
import { KeyPairSchema } from './keypair.js'

export const ActorInfoSchema = Type.Object({
  // The actor for the domain inbox
  actorUrl: Type.String(),
  publicKeyId: Type.String(),
  keypair: KeyPairSchema
})

export type ActorInfo = Static<typeof ActorInfoSchema>
