## Social Inbox JavaScript Client Documentation

## Overview

The Social Inbox JavaScript Client is designed to facilitate interaction with the social inbox from JavaScript services and scripts. It offers a range of functionalities including managing actor information, admins, blocklists, allowlists, followers, hooks, and inbox and outbox activities.

## Getting Started

<!-- ### Installation

```javascript
// If the client is published as an NPM package
npm install social-inbox-client

// Or include it directly (if available as a standalone file)
import { SocialInboxClient } from 'path/to/social-inbox-client'
``` -->

## Initialization

```javascript
import { SocialInboxClient } from "social-inbox-client";

const client = new SocialInboxClient({
  instance: "https://your.instance.url",
  account: "@yourAccount@yourdomain",
  keypair: {
    publicKeyPem: "yourPublicKeyPem",
    privateKeyPem: "yourPrivateKeyPem",
  },
});
```

## Usage examples

### Actor Information Management

Fetch Actor Information

```javascript
const actorInfo = await client.getActorInfo("@actor@domain");
```

Delete an Actor

```javascript
await client.deleteActor("actorName");
```

### Admin Management

List Admins

Returns the global blocklist as an array of strings, each in the format `@username@domain`.

```javascript
const admins = await client.listAdmins();
```

Add Admins

```javascript
await client.addAdmins(["admin1@example.com", "admin2@example.com"]);
```

Remove Admins

```javascript
await client.removeAdmins(["admin1@example.com"]);
```

### Blocklist Management

Fetch Global Blocklist

Returns the global blocklist as an array of strings, each in the format `@username@domain`.

```javascript
const blocklist = await client.getGlobalBlocklist();
```

Add to Blocklist

```javascript
await client.addGlobalBlocklist(["user1@example.com"]);
```

Remove from Blocklist

```javascript
await client.removeGlobalBlocklist(["user1@example.com"]);
```

### Allowlist Management

Fetch Global Allowlist

Returns the global allowlist as an array of strings, each in the format `@username@domain`.

```javascript
const allowlist = await client.getGlobalAllowlist();
```

Add to Allowlist

```javascript
await client.addGlobalAllowlist(["user2@example.com"]);
```

Remove from Allowlist

```javascript
await client.removeGlobalAllowlist(["user2@example.com"]);
```

### Follower Management

#### List Followers

Lists the followers of an actor. By default, it lists the followers of the actor associated with the client instance. The return format is an array of strings, each in the format `@username@domain`.

**Listing followers for the default actor:**
```javascript
const defaultFollowers = await client.listFollowers();
```

**Listing followers for a specific actor:**
```javascript
const specificFollowers = await client.listFollowers("specificActorName");
```


Remove a Follower

```javascript
await client.removeFollower("follower@example.com", "actorName");
```

### Hook Management

Set a Hook

```javascript
const hook = {
  url: "https://webhook.endpoint",
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  }
};
await client.setHook("hookType", hook, "actorName");
```

Fetch a Hook

```javascript
const existingHook = await client.getHook("hookType", "actorName");
```

Delete a Hook

```javascript
await client.deleteHook("hookType", "actorName");
```

### Inbox Management

#### Fetch Inbox

**Fetching inbox for the default actor:**
```javascript
const inboxItemsDefault = await client.fetchInbox();
```

**Fetching inbox for a specific actor:**
```javascript
const inboxItemsSpecific = await client.fetchInbox("specificActorName");
```

Post to Inbox

For more details on the ActivityPub Activity format, refer to the [official ActivityPub documentation](https://www.w3.org/TR/activitypub/#activities).

```javascript
const activity = {
  '@context': 'https://www.w3.org/ns/activitystreams',
  type: 'Create',
  actor: 'https://example.com/user1',
  object: {
    type: 'Note',
    content: 'Hello world',
    id: 'https://example.com/note1'
  }
};
await client.postToInbox(activity, "actorName");
```

Approve an Inbox Item

```javascript
await client.approveInboxItem("itemId", "actorName");
```

Reject an Inbox Item

```javascript
await client.rejectInboxItem("itemId", "actorName");
```

### Outbox Management

Post to Outbox

```javascript
await client.postToOutbox(activity, "actorName");
```

Fetch an Outbox Item

```javascript
const outboxItem = await client.fetchOutboxItem("itemId", "actorName");
```
