import generateIdentity from '../keypair'

console.log('Generating keypair for social inbox...')
const { publicKeyPem, privateKeyPem } = generateIdentity()

console.log('Public key:')
console.log(publicKeyPem)

console.log('Private key:')
console.log(privateKeyPem)
