# Agent skills audit

This record pins the design, React, and copy skills selected for the Aura cohesive product release. The skills guide implementation and review only. They are not bundled into the application or deployed with the site.

## Audited sources

| Skill | Upstream | Commit | Files | Local manifest SHA-256 |
| --- | --- | --- | ---: | --- |
| `composition-patterns` | `vercel-labs/agent-skills` | `b8caa260a420a73042e35521de4b5c8baf6446cc` | 14 | `3CF7238BC713AA919032E2A8D137C0C6C99E808C2B6745D89838B8960CBF7AC5` |
| `writing-guidelines` | `vercel-labs/agent-skills` | `b8caa260a420a73042e35521de4b5c8baf6446cc` | 1 | `BE0730BB2CB0672894B460933B1F66E7DF458B47011F5E3706971D04A20E8707` |
| `react-best-practices` | `vercel-labs/agent-skills` | `b8caa260a420a73042e35521de4b5c8baf6446cc` | 76 | `D7F42F7BC44BABCF7ABD8DE17102798F7123B4A5CE63AF21F09F320711715499` |
| `web-design-guidelines` | `vercel-labs/agent-skills` | `b8caa260a420a73042e35521de4b5c8baf6446cc` | 1 | `4478DA922BB5C135DF8671ED4A5795D65C3C8188ADBB7E2CF941DA81BADBE1E2` |
| `copywriting` | `coreyhaines31/marketingskills` | `7868cb9251fad80a73d26e488a5ad5f6c4a9f335` | 4 | `176A1CB0D3F516121A7D051E5DBE545AD94A86807B2812E4644854D2F8DB1985` |

The manifest digest is the SHA-256 of a sorted list containing each relative file path and its file SHA-256. This makes the installed subtree reproducible without committing the user's global Codex skill directory.

## Security review

- The selected subtrees contain instructions, references, and examples. They contain no executable install hooks or bundled scripts that need to run.
- No selected file requests credentials, uploads repository data, weakens system instructions, or changes Aura's deployment target.
- The Vercel review skills refer to mutable guideline documents. Their current contents were inspected before use. Future changes require another review before adoption.
- Vercel deployment, authentication, React Native, and experimental React view-transition skills were excluded because Aura uses GitHub Pages, Hostinger, Next.js 14, and React 18.
- Only the `copywriting` subtree was installed from the marketing-skills repository. No unrelated bundle content was installed.

## Installation scope

The pinned subtrees were installed to the user's Codex skill directory with the built-in skill installer. No third-party installer script was executed, and no application dependency changed.
