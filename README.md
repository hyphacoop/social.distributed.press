# social.distributed.press
A Social Inbox for Decentralized Publishing and ActivityPub


## How it works

This server runs a minimal implementation of an [ActivityPub Inbox and Outbox](https://activitypub.rocks/).

Here's how to use it:

1. Publish a static site that contains your ActivityPub Actor, Outbox, and Posts. You can fork our [staticpub example](https://github.com/RangerMauve/staticpub.mauve.moe/) or use this [Jekyll Plugin](https://0xacab.org/sutty/jekyll/jekyll-activitypub). Make sure you set up the webfinger endpoint!
1. Generate a keypair using either [OpenSSL](https://blog.joinmastodon.org/2018/06/how-to-implement-a-basic-activitypub-server/#$:~:text=keypair) or `npm run generate-keypair` in this repo
1. Add the public key to your ActivityPub Actor
1. Set up the social inbox server somewhere like `httpa://social.example.com`
1. Note the WebMention compatible format of your account like `@username@social.example.com` which will be used as the `username` in parameters
1. Register your ActorInfo by doing a Signed HTTP POST to `/v1/:username/` with JSON that looks like `{actorURL, publicKeyId, keypair: {publicKeyPEM,privateKeyPem}}` to initialize your inbox. The server will use your keypair to sign HTTP requests for activities you send to your outbox. You can also use the `client.setInfo()` API.
1. Set your Actor's `inbox` property to point at `https://yourserver/v1/:username/inbox`
1. Send any Activities you want to notify your followers with by doing a Signed HTTP POST to `/v1/:username/outbox`

Check out the available API endpoints either in the swagger docs at the `https://yourserver/v1/docs/` or in the JS client API in `/src/client/index.js`.

## Development

This project requires Node.js Version 19.x and NPM.
The code is written using TypeScript in the `src` folder which gets compiled into the `dist` folder.

- Run server right from the source: `npm run dev`
- Lint the code to catch common mistakes and maintain code style: `npm run lint`
- Build JS files to `dist`: `npm run build`
- Build and run server: `npm run start`

## Project structure

- `/scripts`: Scripts for doing tasks like importing blocklists/admins or generating keypairs
- `/src/` Main folder for source code
- `/src/server/` Source code for the inbox server
- `/src/server/api/` HTTP routes
- `/src/client/` Implementation of a JS client to talk to the inbox via `fetch`
