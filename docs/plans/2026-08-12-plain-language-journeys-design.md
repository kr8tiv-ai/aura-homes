# Plain-language Aura journeys design

## Decision

Aura opens with two equal, side-by-side entry points into one platform. Neither entry hides features, locks a mode, or asks visitors to identify with a technical persona. The first leads with the eco-property project; the second leads with the optional blockchain ecosystem. Both stay linked throughout the story.

## Approved entrance copy

- Kicker: **Eco Homes, Tiny Homes, Unique Stays**
- Headline: **Design your eco home. Find the land. Manage the build.**
- Introduction: **Plan or choose an eco home, match it with the right property and keep your team, costs and next steps together.**
- Project card:
  - Eyebrow: **For eco-home enthusiasts**
  - Title: **Plan an eco property**
  - Detail: **Design the home, find land and manage the project.**
- Blockchain card:
  - Eyebrow: **Blockchain ecosystem**
  - Title: **Explore HOMES on X Layer**
  - Detail: **Buy homes with crypto. Follow the HOMES token, property trust and RWA launchpad.**

## Product-language rules

1. Speak first about actions people recognize: design, choose, find, compare, pay and manage.
2. Keep crypto optional. Card/Stripe and X Layer USDC are parallel payment paths wherever a provider supports them.
3. Remove escrow from the customer journey, navigation and marketing narrative. Existing testnet escrow contracts remain isolated technical-demo code until the chain work is reconsidered.
4. Use `planned`, `pilot` and `live` labels beside capabilities, without turning the primary copy into disclaimers.
5. Replace “crypto native” and “testnet proof” persona labels with plain product labels.
6. Preserve the current visual world and animation; this is a language and information-architecture refinement, not another rebrand.

## Story shape

The eco-property journey follows Home → Land → Costs → Team → Payments → Project handoff. The blockchain journey follows Buy with crypto → HOMES → Property trust → RWA launchpad → Useful platform. The current on-chain evidence can be linked from technical documentation but is not positioned as a customer problem.

## Payment model

Payment interfaces will always be provider-aware. A future Stripe/card option is shown alongside X Layer USDC where both are supported. If only one method is supported, the UI says so before quote acceptance. No conversion, bridge, signing or spending happens without explicit user confirmation.

