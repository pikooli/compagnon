"use server";

import { createSpeechmaticsJWT } from "@speechmatics/auth";

export async function getJWT() {
  const apiKey = process.env.SPEECHMATICS_API_KEY;

  if (!apiKey) {
    throw new Error("SPEECHMATICS_API_KEY is not set");
  }

  return createSpeechmaticsJWT({
    type: "flow",
    apiKey,
    ttl: 60,
  });
}
