import fetch from 'node-fetch';

const vapiApiKey = '92a52ae5-040b-445c-939f-0733b1d4b21e'; // From server/.env

async function testVapi() {
  const response = await fetch('https://api.vapi.ai/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${vapiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistant: {
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          systemPrompt: "Return a JSON object: {\"status\": \"ok\"}",
        },
      },
      input: "generate",
      stream: false,
    }),
  });

  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Body:", text);
}

testVapi();
