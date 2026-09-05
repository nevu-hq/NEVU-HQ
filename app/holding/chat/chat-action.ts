export async function dispatchAgentPrompt(
  agentKey: string,
  holdingId: string,
  promptText: string,
  sessionId?: string
) {
  try {
    const res = await fetch("/api/ai/personal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-holding-id": holdingId,
      },
      body: JSON.stringify({
        prompt: promptText,
        sessionId: sessionId || null,
        agentKey,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Dispatch failed");
    }

    console.log(`Response from [${agentKey}]:`, data.response);

    return data.response;
  } catch (err) {
    console.error("Agent dispatch error:", err);
    return null;
  }
}