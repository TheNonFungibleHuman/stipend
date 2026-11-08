# Publishing these docs with Docs7

This folder is a complete [Docs7](https://context7.com/docs/docs7/overview) site: `docs.json` plus
MDX pages. It renders locally and is ready to deploy.

## Preview it

```bash
npx @upstash/docs7 dev --port 4400
```

Verified on 2026-11-08: `Docs7 preview ready`, `/` and `/get-started` both return 200.

## Publish it

Publishing needs a Context7 account, so this step is a human one — it opens a browser to approve a
one-time code:

```bash
npx @upstash/docs7 login      # one-time code + approval link
npx @upstash/docs7 deploy     # prints the public URL
```

Run `deploy` again after any edit to update the same site. `.docs7/project.json` holds the site link
— keep it.

Free plan covers up to three sites, including a custom domain.

## Structure

| Page | Group | What it covers |
| --- | --- | --- |
| `index` | Get started | what it is, the two guarantees, what it is not |
| `get-started` | Get started | the web flow: create → limits → fund → run |
| `how-it-works` | Get started | the handshake, verification, receipts |
| `integration` | Guides | paste-a-prompt, MCP config, raw HTTP, sharing |
| `use-cases` | Guides | six things an agent can buy per call |
| `best-practices` | Guides | limits, refusals, allowlists, demo discipline |
| `tools` | Reference | the four MCP tools and their costs |
| `api` | Reference | the four HTTP endpoints |
| `policy` | Reference | the four checks and refusal semantics |
| `troubleshooting` | Help | the failures that actually happen |
| `faq` | Help | the questions people ask |

## After publishing

1. Point the landing page's **Docs** nav item at the deployed URL (currently `/docs` in-app).
2. Add the URL to the submission writeup.
3. The in-app `/docs` pages stay as an offline mirror; if the deployed site becomes canonical,
   reduce them to a redirect.
