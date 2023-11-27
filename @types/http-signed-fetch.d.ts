declare module 'http-signed-fetch' {
  export function fetch (url: RequestInfo, init?: RequestInit & { publicKeyId: string, keypair: any }): Promise<Response>
  export function create (fetchImplementation: typeof fetch): typeof fetch
  export function generateKeypair (): {
    publicKeyPem: string
    privateKeyPem: string
    publicKeyId: string
  }
}
