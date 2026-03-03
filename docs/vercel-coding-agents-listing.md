# Vercel Coding Agents Listing — Proposed Content for Superset

> This document contains the proposed content for Superset's listing on
> [vercel.com/docs/agent-resources/coding-agents](https://vercel.com/docs/agent-resources/coding-agents).
> It mirrors the format used by existing listings (Conductor, Crush, etc.)
> and is intended to be shared with the Vercel team for inclusion.

---

## 1. Entry on the main Coding Agents page

Add a new `### Superset` section to `/docs/agent-resources/coding-agents`:

```md
### Superset

[Superset](https://superset.sh) is a Mac app for running multiple coding agents in parallel, each in its own git worktree. Configure it to use Vercel AI Gateway for unified spend tracking and observability.

See the [Superset documentation](/docs/agent-resources/coding-agents/superset) for setup details.
```

---

## 2. Dedicated page at `/docs/agent-resources/coding-agents/superset`

```md
---
title: Superset
product: vercel
url: /docs/agent-resources/coding-agents/superset
type: conceptual
prerequisites:
  - /docs/agent-resources/coding-agents
  - /docs/agent-resources
related:
  - /docs/ai-gateway/sdks-and-apis/anthropic-compat
  - /docs/ai-gateway/capabilities/observability
summary: Learn about Superset on Vercel.
---

# Superset

AI Gateway provides [Anthropic-compatible API endpoints](/docs/ai-gateway/sdks-and-apis/anthropic-compat) so you can use [Superset](https://superset.sh) through a unified gateway.

[Superset](https://superset.sh) is a Mac app that lets you run multiple CLI coding agents — including Claude Code, Codex, and OpenCode — in parallel, each in its own git worktree. You can monitor every agent from one place, review changes in a built-in diff viewer, and merge results when ready.

## Configuring Superset

Superset runs coding agents inside fully-featured terminal sessions. Environment variables you set in your shell profile are available to every agent.

You can configure your agents to use Vercel AI Gateway, enabling you to:

- Monitor traffic and token usage in your AI Gateway Overview
- View detailed traces in Vercel Observability under AI

- ### Create an API key
  Go to the [**AI Gateway**](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway&title=Go+to+AI+Gateway) section in the Vercel dashboard sidebar and click **API keys** to create a new API key.

- ### Configure environment variables
  Add the following to your shell profile (`~/.zshrc` or `~/.bashrc`):
  ```bash
  export ANTHROPIC_BASE_URL="https://ai-gateway.vercel.sh"
  export ANTHROPIC_AUTH_TOKEN="your-vercel-ai-gateway-api-key"
  export ANTHROPIC_API_KEY=""
  ```
  > **💡 Note:** Setting `ANTHROPIC_API_KEY` to an empty string is required. This prevents
  > Claude Code from attempting to authenticate with Anthropic directly.

  Alternatively, add these exports to a workspace setup script (`.superset/setup.sh`) to scope the configuration to a specific project:
  ```bash
  #!/bin/bash
  # .superset/setup.sh
  export ANTHROPIC_BASE_URL="https://ai-gateway.vercel.sh"
  export ANTHROPIC_AUTH_TOKEN="your-vercel-ai-gateway-api-key"
  export ANTHROPIC_API_KEY=""
  ```
  Check out the [Claude Code docs](https://docs.anthropic.com/en/docs/claude-code) for a full list of environment variables.

- ### Start using Superset
  Open Superset, create a workspace, and launch an agent. Your requests will now be routed through Vercel AI Gateway. You can verify this by checking your [AI Gateway Overview](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway&title=Go+to+AI+Gateway) in the Vercel dashboard.

- ### (Optional) Monitor usage and spend
  View your usage, spend, and request activity in the [**AI Gateway**](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway&title=Go+to+AI+Gateway) section in the Vercel dashboard sidebar. See the [observability documentation](/docs/ai-gateway/capabilities/observability) for more details.
```

---

## 3. Update "Next steps" section

Add to the "Next steps" list on the main coding agents page:

```md
- [Configure Superset](/docs/agent-resources/coding-agents/superset) for parallel agents in isolated worktrees
```

---

## Contact

Coordination: Allen Zhou & Jerilyn Zheng (Vercel)
Superset website: https://superset.sh
Superset docs: https://docs.superset.sh
GitHub: https://github.com/superset-sh/superset
