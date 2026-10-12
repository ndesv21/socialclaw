# Claude directory submission — SocialClaw 0.1.24

## Prepared source

Submit `plugins/socialclaw`, not the repository root. This focused folder contains the manifest, hosted OAuth MCP configuration, Claude skill, README, icon, and MIT license. The root also contains the independently useful CLI, OpenClaw, and Hermes assets; those are outside the directory bundle.

To regenerate copied files after edits:

```sh
npm run build:claude-plugin
claude plugin validate plugins/socialclaw --strict
```

Edit the Claude skill at `skills/socialclaw/SKILL.md`, the root manifest, and the root MCP configuration, then rebuild. Maintain the bundle README directly. Increment versions for subsequent releases; the npm version lifecycle synchronizes and rebuilds the plugin. Publishing to npm is not required to submit a hosted MCP plugin.

## Before the portal

- Push the reviewed files to a GitHub branch accessible to the Claude GitHub connection. The portal reads GitHub, not this computer.
- Use the Team organization that should own SocialClaw's listing long term, signed in as its Owner.
- Connect a GitHub account with push access to `ndesv21/socialclaw` in that same Claude organization.
- Add `https://getsocialclaw.com/mcp` as a custom connector and finish browser OAuth. Confirm the correct workspace with “Show my SocialClaw workspace and connected accounts.”
- Test every tool before affirming the portal's testing declaration. Use a dedicated populated reviewer workspace and test social accounts for write operations. Do not run publication, messaging, or deletion tests on real customer content.

## 1. Submit the MCP connector

Open https://claude.ai/directory/manage → Submit new → MCP connector.

- Server URL: `https://getsocialclaw.com/mcp`
- Name: `SocialClaw`
- Suggested one-liner: `Schedule social posts, track delivery and analytics, and manage Instagram comments and messages with SocialClaw.`
- Documentation: https://getsocialclaw.com/docs/mcp
- Privacy: https://getsocialclaw.com/privacy
- Support: https://getsocialclaw.com/contact — support@getsocialclaw.com
- Icon: `plugins/socialclaw/logo.png`
- Authentication: OAuth with dynamic client registration. Discovery advertises the authorization, token, and registration endpoints; verify actual sign-in in Claude.
- Use cases: publishing and scheduling, media-library access, delivery troubleshooting, analytics, and Instagram comment/message management.
- Requirements: a SocialClaw workspace, appropriate plan entitlement, and connected social accounts for provider operations.
- Access: reads and writes workspace data; publishing, replies, moderation, and cancellations are write operations.

Enter actual company/contact details and reviewer account credentials only in the appropriate portal fields. Answer data-handling and policy declarations from actual service behavior and the published privacy policy; do not infer retention or make unverified attestations. Review the synced tools for warnings. The 34-tool count is a check dated October 12, 2026, not a permanent limit.

## 2. Submit the plugin bundle

In the same organization, choose Submit new → Plugin bundle.

- Repository: `https://github.com/ndesv21/socialclaw`
- Plugin path: `plugins/socialclaw`
- Branch: the branch to which these files were pushed (use `main` only after merging there).
- Select Validate. Resolve any blocking findings and validate again against the exact updated commit.
- Review the listing imported from the manifest and README.
- Complete data handling, contact, and policy acknowledgments truthfully.
- Submit for review; publish only once eligible and when you intend the listing to become public.
- Pair the connector and plugin in the portal when that option is available. Both use the identical MCP URL to avoid duplicate tools.

Choose scheduled checks if you do not want to configure a GitHub webhook. Keep automatic publication off until the initial release and behavior have been reviewed.

## Remaining user/portal checks

OAuth discovery and public tool metadata checks do not prove end-to-end OAuth or tool execution. Complete sign-in, populated reviewer access, and tool testing in Claude. Directory validation, name availability, review, and publication happen in the portal. This source preparation does not submit a listing or deploy the SocialClaw server.

## Official references

- https://claude.com/docs/directory/publish
- https://claude.com/docs/plugins/submit
- https://claude.com/docs/plugins/pre-submission-checklist
- https://claude.com/docs/connectors/building/submission
