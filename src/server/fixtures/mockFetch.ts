import { parseMention } from '../apsystem'

export class MockFetch extends Map<string, BodyInit> {
  history: string[]
  constructor () {
    super()
    this.history = []
    this.fetch = this.fetch.bind(this)
  }

  async fetch (url: string): Promise<Response> {
    if (!this.has(url)) throw new Error(`Failed to mock request to ${url}`)
    this.history.push(url)

    return new Response(this.get(url) as BodyInit)
  }

  setObject (key: string, value: any): void {
    this.set(key, JSON.stringify(value))
  }

  mockActor (mention: string): string {
    const { username, domain } = parseMention(mention)
    const actorUrl = `https://${domain}/actor/${username}/`
    const webmentionURL = `https://${domain}/.well-known/webfinger?resource=acct:${username}@${domain}`

    this.setObject(webmentionURL, {
      subject: `acct:${username}@${domain}`,
      aliases: [actorUrl],
      links: [{
        rel: 'self',
        type: 'application/activity+json',
        href: actorUrl
      }]
    })

    this.setObject(actorUrl, {

      '@context': [
        // TODO: I copied this from Mastodon, is this correct?
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1'
      ],
      // https://www.w3.org/TR/activitystreams-vocabulary/#actor-types
      id: actorUrl,
      type: 'Person',
      name: 'Announcements',
      summary: `Subscribe to get notified about new accounts hosted at ${actorUrl}`,
      preferredUsername: 'announcements',
      following: `${actorUrl}following`,
      followers: `${actorUrl}followers`,
      inbox: `${actorUrl}inbox`,
      outbox: `${actorUrl}outbox`

    })

    return actorUrl
  }
}
