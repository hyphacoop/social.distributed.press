import { AbstractLevel } from "abstract-level";
import { APActivity } from "activitypub-types";

export class ActivityStore {
  db: AbstractLevel<any, string, any>;

  constructor(db: AbstractLevel<any, string, any>) {
    this.db = db;
  }

  urlToKey(url: string): string {
    // URL encode the url to clean up the special chars before inserting
    return encodeURIComponent(url);
  }

  async add(activity: APActivity): Promise<void> {
    if (!activity.id) {
      throw new Error("Activity ID is missing.");
    }
    const key = this.urlToKey(activity.id);
    await this.db.put(key, activity);
  }

  async remove(url: string): Promise<void> {
    const key = this.urlToKey(url);
    await this.db.del(key);
  }

  async get(url: string): Promise<APActivity> {
    const key = this.urlToKey(url);
    try {
      const activity: APActivity = await this.db.get(key);
      return activity;
    } catch (error) {
      throw new Error(`Activity not found for URL: ${url}`);
    }
  }

  async list(): Promise<APActivity[]> {
    const activities: APActivity[] = [];
    for await (const [, value] of this.db) {
      activities.push(value);
    }
    return activities;
  }
}
