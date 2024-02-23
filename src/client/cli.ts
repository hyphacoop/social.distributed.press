import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { SocialInboxClient } from './index.js'
import { generateKeypair } from 'http-signed-fetch'
import { DEFAULT_PUBLIC_KEY_FIELD } from '../server/apsystem.js'

// https://github.com/yargs/yargs/issues/225
const argv = yargs(hideBin(process.argv))
  .usage('usage: $0 <account>')
  .demandCommand(1)
  .options({
    url: { type: 'string', default: 'http://localhost:8080' },
    announce: { type: 'boolean', default: true }
  }).parseSync()

const account = `${argv._[0]}`
const { url, announce } = argv

// XXX: is this safe to assume?
const [, username, instance] = account.split('@')
if (username === undefined || instance === undefined) {
  throw new Error('missing username or instance')
}
const actorUrl = `https://${instance}/@${username}`
const publicKeyId = `${actorUrl}#${DEFAULT_PUBLIC_KEY_FIELD}`

const keypair = generateKeypair()
const client = new SocialInboxClient({
  instance: url,
  keypair: { ...keypair, publicKeyId },
  account
})

// ref: https://github.com/RangerMauve/staticpub.mauve.moe/blob/default/create_account.js
await client.setInfo({
  actorUrl,
  publicKeyId,
  keypair,
  announce
})
