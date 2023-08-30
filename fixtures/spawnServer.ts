import envPaths from 'env-paths'
import path from 'path'
import apiBuilder, { FastifyTypebox } from '../api/index.js'
import { nanoid } from 'nanoid'

const paths = envPaths('social.distributed.press')
export async function spawnTestServer (): Promise<FastifyTypebox> {
  const storagePath = path.join(paths.temp, 'tests', nanoid())
  return await apiBuilder({
    useMemoryBackedDB: true,
    port: 8080,
    host: 'localhost',
    storage: storagePath
  })
}
