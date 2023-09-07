import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
import { Level } from 'level'

import Store from '../store/index.js'

const paths = envPaths('social.distributed.press')

const argv = yargs(hideBin(process.argv)).options({
  storage: { type: 'string' },
  list: { type: 'string', array: true }
}).parseSync()

const storage = argv.storage ?? paths.data
const list = argv.list ?? []

if (list.length === 0) {
  console.log(`No admins specified. Please use the following format to add them:
npm run import-admins -- --list @admin1@example.com --list @*@example2.com
`)
}

const db = new Level(storage, { valueEncoding: 'json' })

const store = new Store(db)

console.log(`Adding admins to store to store:\n${storage}`)
console.log(list)
await store.admins.add(list)
