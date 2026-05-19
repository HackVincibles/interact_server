import fetch from 'node-fetch';

const vapiApiKey = '92a52ae5-040b-445c-939f-0733b1d4b21e';

async function testVapi() {
  const systemPrompt = `Evaluate the candidate dynamically based purely on the provided transcript.
You MUST return ONLY valid JSON matching this exact schema. Do NOT return markdown formatting (do not wrap in \`\`\`json) or extra text.
Replace the example numbers and placeholder strings below with the candidate's ACTUAL dynamic evaluation scores:

{
  "totalScore": <evaluate dynamic total score 0-100>,
  "categoryScores": {
    "communicationSkills": <dynamic score 0-100>,
    "technicalKnowledge": <dynamic score 0-100>,
    "problemSolving": <dynamic score 0-100>,
    "culturalFit": <dynamic score 0-100>,
    "confidenceClarity": <dynamic score 0-100>
  },
  "strengths": ["<dynamic strength 1>", "<dynamic strength 2>"],
  "areasForImprovement": ["<dynamic improvement 1>", "<dynamic improvement 2>"],
  "finalAssessment": "<dynamic summary based on the interview>",
  "rating": <dynamic rating 1-5>
}

IMPORTANT: Your response must be the complete JSON object starting with { and ending with }. Do not omit the opening brace.`;

  const transcript = "Candidate: Hello. Interviewer: What is React? Candidate: A UI library.";

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
          model: 'gpt-4o',
          systemPrompt: systemPrompt,
        },
      },
      input: "Transcript:\n" + transcript + "\n\nPlease generate the JSON feedback report.",
      stream: false,
    }),
  });

  const data = await response.json();
  let content = data.output?.[0]?.content || '';
  console.log("RAW CONTENT START");
  console.log(content);
  console.log("RAW CONTENT END");
  
  try {
    let trimmed = content.trim();
    if (trimmed.startsWith('"totalScore"')) {
      content = '{\n' + content;
    }

    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    console.log("JSON START:", jsonStart, "JSON END:", jsonEnd);
    const jsonString = content.substring(jsonStart, jsonEnd + 1);
    JSON.parse(jsonString);
    console.log("PARSE SUCCESS!");
  } catch (e) {
    console.error("PARSE FAILED:", e.message);
  }
}

testVapi();
