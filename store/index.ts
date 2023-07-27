import { AbstractLevel } from 'abstract-level'
import { APIConfig } from '../api/index.js'

export interface StoreI {
}

export default class Store implements StoreI {
  db: AbstractLevel<any, string, any>

  constructor (cfg: APIConfig, db: AbstractLevel<any, string, any>) {
    this.db = db
  }
}
