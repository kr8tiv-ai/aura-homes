import "server-only";

import {
  createOpenRouterDesignIntentAdapter,
  type OpenRouterTransport,
  type OpenRouterTransportContext,
  type OpenRouterTransportRequest,
} from "../ai/openRouterDesignIntentAdapter";
import { DesignIntentAdapterFailure, type DesignIntentAdapter } from "../ai/designIntentAdapter";

const OPENROUTER_CHAT_COMPLETIONS_ENDPOINT =
  "https://openrouter.ai/api/v1/chat/completions" as const;

const boundedSecret = (value: string | undefined): string => {
  if (!value || value.length > 512 || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new DesignIntentAdapterFailure("unavailable");
  }
  return value;
};

const boundedModel = (value: string | undefined): string => {
  if (!value || value.length > 256 ||
      !/^[a-z0-9][a-z0-9._-]{0,63}\/[A-Za-z0-9][A-Za-z0-9._:-]{0,190}$/.test(value)) {
    throw new DesignIntentAdapterFailure("unavailable");
  }
  return value;
};

const allowedModels = (value: string | undefined): ReadonlySet<string> => {
  if (!value || value.length > 4_096) throw new DesignIntentAdapterFailure("unavailable");
  const entries = value.split(",");
  if (entries.length === 0 || entries.length > 32) throw new DesignIntentAdapterFailure("unavailable");
  const models = entries.map((entry) => boundedModel(entry));
  if (new Set(models).size !== models.length) throw new DesignIntentAdapterFailure("unavailable");
  return new Set(models);
};

export function createServerOpenRouterDesignIntentAdapter(): DesignIntentAdapter {
  if (process.env.AURA_OPENROUTER_LIVE_ENABLED !== "true") {
    throw new DesignIntentAdapterFailure("unavailable");
  }
  const apiKey = boundedSecret(process.env.OPENROUTER_API_KEY);
  const modelId = boundedModel(process.env.AURA_OPENROUTER_MODEL);
  const allowlist = allowedModels(process.env.AURA_OPENROUTER_ALLOWED_MODELS);
  if (!allowlist.has(modelId)) throw new DesignIntentAdapterFailure("unavailable");

  const transport: OpenRouterTransport = Object.freeze({
    async send(request: OpenRouterTransportRequest, context: OpenRouterTransportContext) {
      const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: context.signal,
        cache: "no-store",
      });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { status: response.status, body };
    },
  });

  return createOpenRouterDesignIntentAdapter({ modelId, transport });
}
