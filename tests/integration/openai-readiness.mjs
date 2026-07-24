import nextEnv from "@next/env";
import OpenAI from "openai";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const apiKey = process.env.OPENAI_API_KEY?.trim();
const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";

if (!apiKey) {
  console.log(JSON.stringify({ apiKeyPresent: false, model }));
  process.exitCode = 2;
} else {
  try {
    const client = new OpenAI({ apiKey });
    const details = await client.models.retrieve(model);
    console.log(
      JSON.stringify({
        apiKeyPresent: true,
        authenticationSucceeded: true,
        requestedModel: model,
        modelAvailable: details.id === model,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        apiKeyPresent: true,
        authenticationSucceeded: false,
        requestedModel: model,
        errorStatus:
          error && typeof error === "object" && "status" in error
            ? error.status
            : null,
        errorCode:
          error && typeof error === "object" && "code" in error
            ? error.code
            : null,
        errorType:
          error && typeof error === "object" && "type" in error
            ? error.type
            : null,
      }),
    );
    process.exitCode = 1;
  }
}
