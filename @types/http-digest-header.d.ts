declare module '@digitalbazaar/http-digest-header' {
  export interface DigestOptions {
    data: string
    algorithm: string
    useMultihash: boolean
  }
  export interface VerifyDigestOptions {
    data: string
    headerValue: string
  }
  export function createHeaderValue (options: DigestOptions): Promise<string>
  export function verifyHeaderValue (options: VerifyDigestOptions): Promise<boolean>
}
