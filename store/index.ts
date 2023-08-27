import { AbstractLevel } from "abstract-level";
import { APIConfig } from "../api/index.js";
import { APActivity } from "activitypub-types";
import { KeyPair } from "../keypair.js";
import { ActorStore } from "./ActorStore";
import { AccountListStore } from "./AccountListStore";

export interface ActorInfo {
  // The actor for the domain inbox
  actorUrl: string;
  publicKeyId: string;
  keypair: KeyPair;
}

export default class Store {
  db: AbstractLevel<any, string, any>;
  actorCache: Map<string, ActorStore>;
  actorsDb: AbstractLevel<any, string, any>;
  blocklist: AccountListStore;
  allowlist: AccountListStore;
  config: APIConfig;

  constructor(config: APIConfig, db: AbstractLevel<any, string, any>) {
    this.config = config;
    this.db = db;
    this.actorCache = new Map();
    this.actorsDb = this.db.sublevel("actorCache", { valueEncoding: "json" });
    const blocklistDb = this.db.sublevel("blocklist", {
      valueEncoding: "json",
    });
    this.blocklist = new AccountListStore(blocklistDb);
    const allowlistDb = this.db.sublevel("allowlist", {
      valueEncoding: "json",
    });
    this.allowlist = new AccountListStore(allowlistDb);
  }

  forActor(domain: string): ActorStore {
    if (!this.actorCache.has(domain)) {
      const sub = this.db.sublevel(domain, { valueEncoding: "json" });
      const store = new ActorStore(sub);
      this.actorCache.set(domain, store);
    }

    const store = this.actorCache.get(domain);
    if (store == null) {
      throw new Error("Domain store not initialixed");
    }
    return store;
  }
}
