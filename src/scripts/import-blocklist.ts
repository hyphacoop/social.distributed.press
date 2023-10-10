import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
import { Level } from 'level'
import { parse } from 'csv-parse'
import { Readable } from 'node:stream'

import Store from '../server/store/index.js'

const paths = envPaths('social.distributed.press')

const DEFAULT_BLOCK_LIST = 'https://github.com/gardenfence/blocklist/raw/main/gardenfence-mastodon.csv'
const DOMAIN_KEY = '#domain'

const argv = yargs(hideBin(process.argv)).options({
  storage: { type: 'string' },
  list: { type: 'string' }
}).parseSync()

const storage = argv.storage ?? paths.data
const list = argv.list ?? DEFAULT_BLOCK_LIST

const db = new Level(storage, { valueEncoding: 'json' })

const store = new Store(db)

console.log(`Downloading blocklist:\n${list}`)

const response = await fetch(list)

if (!response.ok) {
  throw new Error(await response.text())
}

if (response.body == null) {
  throw new Error(`No blocklist in response at ${list}`)
}

console.log(`Parsing blocklist csv to add to store:\n${storage}`)

// TODO: Fight typescript since it doesn't want me to use `response.body` as a stream
const parser = Readable.from(await response.text())
  .pipe(parse({
    columns: true
  }))

for await (const record of parser) {
  const domain = record[DOMAIN_KEY]
  if (typeof domain !== 'string') {
    throw new Error(`CSV file must follow the Mastodon blocklist format and contain rows with a ${DOMAIN_KEY} column`)
  }
  console.log('Adding', domain)
  await store.blocklist.add([`@*@${domain}`])
}
