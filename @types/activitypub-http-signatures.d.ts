declare module 'activitypub-http-signatures' {
  export interface RequestOptions {
    method?: string
    url?: string
    headers?: {
      [headerName: string]: string | string[] | undefined
    }
  }
  export class Parser {
    sign (options: RequestOptions): Sha256Signature
    parse (options: RequestOptions): Sha256Signature
  }

  export interface SignerOptions {
    publicKeyId: string
    privateKey: string
    headerNames?: string[]
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

  const parser: Parser
  export default parser
}
