# Add an LLM provider

Goal: wire a new content model behind the existing ports, so `auto` and an
explicit `MODEL_PROVIDER` can reach it, with the same retry policy, deadlines,
streaming and structured output as the built-in providers.

Everything a feature knows about generation is the two ports
(`TextModel`, `StructuredModel` in `apps/api/src/shared/application/ports/`). A
provider is anything that satisfies both; retries, timeouts and the error
taxonomy are shared, not per-provider. Adding Gemini followed the steps below, so
trace that commit for a complete worked example.

## Two routes to the ports

- **OpenAI-compatible** (`/chat/completions`) is the fast path. OpenCode Zen and
  Gemini both hang off `OpenAiCompatibleClient`, so most providers need only a
  thin injectable adapter plus configuration — steps 1–4.
- **A native route** (like Anthropic's `/messages`) needs a full adapter written
  from scratch. The contract it must honour: text plus streaming via an
  `AsyncGenerator`, structured output re-validated against the zod schema, a hard
  deadline per call, and failures mapped to the `ModelProviderError` taxonomy
  (`llm_error` for permanent faults, `llm_unavailable` when a retry could help).
  Use `anthropic-model.adapter.ts` as the template.

## 1. Add the configuration

In `apps/api/src/config/env.ts`:

1. Add the env schema fields — key, base URL (if any), model, max tokens,
   timeout.
2. Add a matching `AppConfig` block.
3. Parse them in `toAppConfig`, trimming a trailing slash from the base URL so
   the adapter's appended path does not double up.
4. Add the provider to the `MODEL_PROVIDER` enum.
5. Extend `resolveModelProvider`: in the explicit branch, fall back to `scripted`
   when the provider's key is missing; in the `auto` branch, insert the provider
   where you want it in the priority order.

Gemini's additions:

```ts
MODEL_PROVIDER: z.enum(['auto', 'opencode', 'gemini', 'anthropic', 'scripted']).default('auto'),
// ...
GEMINI_API_KEY: z.string().default(''),
GEMINI_BASE_URL: z.string().default('https://generativelanguage.googleapis.com/v1beta/openai'),
GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
GEMINI_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
```

`auto` is resolved once, at boot, in this order: OpenCode Zen, Gemini, Anthropic,
then the local generator.

## 2. Add the adapter

For an OpenAI-compatible provider, reuse the client and keep the adapter a thin
shell (copy `gemini-model.adapter.ts`):

```ts
@Injectable()
export class MyModelAdapter implements TextModel, StructuredModel {
  readonly #client: OpenAiCompatibleClient

  constructor(@Inject(ENV) config: AppConfig) {
    this.#client = new OpenAiCompatibleClient(
      { ...config.myprovider, label: 'My Provider' },
      new Logger(MyModelAdapter.name),
    )
  }

  get modelId(): string {
    return this.#client.modelId
  }

  generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    return this.#client.generate(request)
  }

  stream(request: TextGenerationRequest): AsyncGenerator<string, void, undefined> {
    return this.#client.stream(request)
  }

  generateStructured<TSchema extends z.ZodTypeAny>(
    request: StructuredGenerationRequest<TSchema>,
  ): Promise<StructuredGenerationResult<z.output<TSchema>>> {
    return this.#client.generateStructured(request)
  }
}
```

`label` is what appears in failure logs (`"My Provider request failed: …"`), so
name the provider. The client holds no Nest imports, which is what lets the wire
format be tested without booting the framework.

## 3. Register the adapter

- `apps/api/src/shared/infrastructure/llm/llm-selection.ts`
  - add it to `AdapterSet`;
  - add a case to the `selectAdapters` switch;
  - add a case to `describeProvider` for the boot log line;
  - add it to `PROVIDER_KEY` so a missing key is reported with the right env
    variable name.
- `apps/api/src/shared/infrastructure/llm/llm.module.ts`
  - add the adapter to `providers`;
  - add it to the `SELECTED_MODEL` factory's `inject` list and its parameters.

## 4. Set the key and confirm

Put the key in `apps/api/.env` (example rows belong in `.env.example`), restart,
and read the boot line:

```
Content model: Gemini (gemini-2.5-flash via https://generativelanguage.googleapis.com/v1beta/openai)
```

Wiring a key while `MODEL_PROVIDER=auto` is all that is needed to change models —
the app is otherwise identical.

## 5. Cover it in tests

- `apps/api/src/config/env.spec.ts`: the new auto priority order, empty-key
  fallback to `scripted`, an explicit choice honoured, base-URL normalisation.
- `apps/api/src/shared/infrastructure/llm/llm-selection.spec.ts`: selection
  returns the new adapter, `describeLlmMode` names it, and a requested provider
  with no key names the correct env variable.
- If the wire format is new, add a spec beside
  `openai-compatible.client.spec.ts` that stubs `fetch` and pins what goes out,
  what comes back, and which failures are retryable.

## 6. Update the supporting docs

- `.env.example` and `docs/reference/configuration.md`: the new variables and the
  `auto` order.
- `docs/explanation/generative-pipeline.md` and
  `docs/explanation/architecture.md`: the adapter list and `auto` walk order.
- `docs/how-to/generate-a-campaign.md` and
  `docs/how-to/run-without-a-model-key.md`: the list of optional keys.
- The root `README.md` if it names providers.

## Notes

- **Selection is config-time; retries are per-provider.** `auto` picks once at
  boot, and a provider that stays down yields `503 llm_unavailable` after the
  retry budget — never a silent switch to another provider mid-request.
- **The key never surfaces.** Failure logs keep a truncated response body and the
  client-facing message names neither the key nor the URL.
- **Structured output is promised, not trusted.** The provider is asked to
  constrain itself with the zod JSON Schema, and the answer is re-validated
  anyway. A provider that ignores `response_format` produces the schema error,
  not corrupt data.
- **Every provider shares the same deadline and retry policy.** There is no
  per-provider tuning surface on purpose: the budget lives in
  `LLM_RETRY_MAX_ATTEMPTS`, `LLM_RETRY_BASE_DELAY_MS`, `LLM_RETRY_MAX_DELAY_MS`
  and the `*_TIMEOUT_MS` variables.