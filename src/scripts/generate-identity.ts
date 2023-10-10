import generateIdentity from '../keypair'

const keyPair = generateIdentity()

console.log(JSON.stringify(keyPair, null, '  '))
