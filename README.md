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

### Testing out the API

You can use the Swagger UI (`http://localhost:8080/v1/docs/static/index.html`) to test out API endpoints.


#### Testing out internal authenticated endpoints

To test out internal authenticated endpoints, you can just comment out the authentication check on the endpoint's code (usually around a call to `apsystem.hasPermissionActorRequest()`.)

Keep in mind that the actor you want to impersonate must actually exist; that is, it has to be able to respond to webfinger. Also, you should register it first locally to be able to use other endpoints by calling `POST /v1/{actor}` (you will need to bypass authentication in `src/server/api/creation.ts` like mentioned previously.) You need to pass vaild keys when creating the actor, which you can generate by running `npm run generate-identity`.

#### Testing out ActivityPub server-to-server endpoints

To test out external (ActivityPub server-to-server) endpoints, you can short-circuit [`APSystem.verifySignedRequest`](https://github.com/hyphacoop/social.distributed.press/blob/3e9c803a050ef5342c16441fa048951eccae1f52/src/server/apsystem.ts#L91) and return the actor you want to impersonate.

Keep in mind that the actor you want to impersonate must actually exist; that is, it has to be able to respond to webfinger.

For example, to impersonate `@sutty@sutty.nl`, you can add `return '@sutty@sutty.nl'` at the beginning of `verifySignedRequest` and send activites with the actor:

<details>
<summary>Example POST to /v1/{actor}/inbox</summary>


`POST /v1/{actor}/inbox`

```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    {
      "@language": "es",
      "sensitive": "as:sensitive"
    }
  ],
  "actor": "https://sutty.nl/about.jsonld",
  "type": "Note",
  "id": "https://sutty.nl/lanzamiento-de-publicaciones-distribuidas-en-el-fediverso-a-trav%C3%A9s-de-sutty.jsonld",
  "url": [
    {
      "type": "Link",
      "mediaType": "text/html",
      "href": "https://sutty.nl/lanzamiento-de-publicaciones-distribuidas-en-el-fediverso-a-trav%C3%A9s-de-sutty/",
      "rel": "canonical"
    },
    {
      "type": "Link",
      "mediaType": "application/ld+json; profile=\"https://www.w3.org/ns/activitystreams\"",
      "href": "https://sutty.nl/lanzamiento-de-publicaciones-distribuidas-en-el-fediverso-a-trav%C3%A9s-de-sutty.jsonld",
      "rel": "alternate"
    },
    {
      "type": "Link",
      "mediaType": "application/activity+json",
      "href": "https://sutty.nl/lanzamiento-de-publicaciones-distribuidas-en-el-fediverso-a-trav%C3%A9s-de-sutty.jsonld",
      "rel": "alternate"
    }
  ],
  "summary": "Lanzamiento de publicaciones distribuidas en el Fediverso a través de Sutty",
  "published": "2023-12-04T21:53:05+00:00",
  "updated": "2023-12-05T20:41:34+00:00",
  "attributedTo": "https://sutty.nl/about.jsonld",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cc": ["https://social.distributed.press/v1/@sutty@sutty.nl/followers"],
  "inReplyTo": "https://hypha.coop/dripline/announcing-dp-social-inbox/",
  "sensitive": false,
  "content": "content"
}
```

(activity derived from the [real one](https://sutty.nl/lanzamiento-de-publicaciones-distribuidas-en-el-fediverso-a-trav%C3%A9s-de-sutty.jsonld))

</details>

## Project structure

- `/scripts`: Scripts for doing tasks like importing blocklists/admins or generating keypairs
- `/src/` Main folder for source code
- `/src/server/` Source code for the inbox server
- `/src/server/api/` HTTP routes
- `/src/client/` Implementation of a JS client to talk to the inbox via `fetch`
