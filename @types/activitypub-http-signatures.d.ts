declare module 'activitypub-http-signatures' {

  export interface RequestOptions {
    method?: string
    url?: string
    headers?: Headers
  }
  export class Parser {
    sign (options: RequestOptions): Sha256Signature
  }

  export interface SignerOptions {
    publicKeyId: string
    privateKey: string
    headerNames: string[]
  }

  export class Sha256Signer {
    constructor (options: SignerOptions)
    sign (options: RequestOptions): string
  }

  export class Sha256Signature {
    signature: Buffer
    string: string
    keyId: string

    verify (publickey: string): boolean
  }

  declare const parser: Parser
  export default parser
}
