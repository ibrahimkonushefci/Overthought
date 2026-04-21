# Overthought Verdict Engine Starter

This folder contains a drop-in TypeScript starter engine for the v1 deterministic verdict system.

## What is included

- `types.ts` - shared engine types
- `config.ts` - typed config loader and runtime validation
- `normalize.ts` - input normalization helpers
- `patterns.ts` - phrase matching helpers
- `copy.ts` - human-readable signal copy and template helpers
- `analyzeCase.ts` - main scoring function
- `index.ts` - public exports
- `exampleUsage.ts` - simple usage example
- `config/verdict-config.v1.json` - engine config copied locally

## Intended usage

Put the whole `src/features/verdict-engine` folder into your Expo / React Native project and import:

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
- light case updates are supported through `previousCaseContext` + `updateText`
- the config is designed to be tuned without changing engine code

## Suggested future expansion

- swap or tune config only
- add category-specific copy packs
- add tone packs
- add hybrid AI rewrite layer on premium only
- add localization support
