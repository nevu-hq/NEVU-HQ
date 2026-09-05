# NEVU HQ Architecture

## Core boundary
A Holding contains exactly one Sole Administrator. AI specialist roles are not human members. The Personal AI is private to its Administrator.

## Areas
- **Holding HQ:** the private home for one Holding.
- **Discussion Room:** the Holding's working room. Every event is a **Session**.
- **NEVU HQ Boardroom:** the network base where Holding Administrators talk Holding-to-Holding. Only information required for HQ identity, governance and the Boardroom conversation is exposed.
- **Personal AI:** private second-opinion layer. It can review the Administrator's conversation with agents/Boardroom context available to that Administrator and suggest additional considerations.
- **Portfolio:** records current positions and capital snapshots. Portfolio Architect proposes; Administrator approval is required before an action is marked approved/executed.
- **Archive:** permanent official decision records for the current Holding.

## AI role/provider separation
The nine NEVU roles are constitutional roles. Providers are replaceable engines. A role can be assigned to OpenAI, Anthropic, Gemini, xAI, Hugging Face/Llama or a local browser bridge.

## Availability
NEVU HQ itself is hosted on Render and backed by Supabase, so the Administrator's Holding, sessions, messages, archive and settings do not depend on a personal computer being online. The optional local browser bridge is only a provider connector.

## Security
Private Holding tables use Row Level Security. The Boardroom uses a safe directory function for network identity/presence rather than granting cross-Holding access to private Holding tables.
