# Overthought Verdict Engine Starter

This folder contains app-facing entrypoints for the deterministic verdict system. The canonical implementation lives in `supabase/functions/_shared/verdict-engine/` so the app and Supabase Edge Function use the same calibration code.

## What is included

- `types.ts` - re-exports shared engine types
- `config.ts` - re-exports the shared typed config
- `normalize.ts`, `patterns.ts`, and `copy.ts` - re-export shared helpers
- `analyzeCase.ts` - re-exports the shared scoring function
- `index.ts` - public app exports
- `exampleUsage.ts` - simple usage example

## Intended usage

Import through the app-facing entrypoints:

```ts
import { analyzeCase } from '@/features/verdict-engine';
import { verdictConfig } from '@/features/verdict-engine/config';
```

Then call:

```ts
const result = analyzeCase(verdictConfig, {
  inputText: "He liked my story and replied after 9 hours",
  category: "romance",
});
```

## tsconfig note

The `config.ts` file imports JSON. In TypeScript, enable:

```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "esModuleInterop": true
  }
}
```

## Product assumptions

- v1 is deterministic and cheap to run
- the app is not a chatbot
- the engine can re-analyze with `previousCaseContext` + `updateText`, but the **v1 app does not call it on update** — updates are stored as timeline receipts only; re-analysis on update is a future enhancement
- the config drives bands, weights, patterns, and banded copy; note that some semantic scenarios and fallback copy currently live in `facts.ts` and `copy.ts`, so not all tuning is config-only today

## Suggested future expansion

- swap or tune config only
- add category-specific copy packs
- add tone packs
- add hybrid AI rewrite layer on premium only
- add localization support
