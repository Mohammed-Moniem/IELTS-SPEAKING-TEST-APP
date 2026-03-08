/* ------------------------------------------------------------------ */
/*  Section 2 - Everyday Monologue (1 speaker)                        */
/*  Claude prompt template for IELTS Listening pre-generation         */
/* ------------------------------------------------------------------ */

export const SYSTEM_PROMPT = `You are an expert IELTS Listening test content author. Your task is to generate Section 2 content for an IELTS Listening test.

SECTION 2 SPECIFICATION:
- Format: A SINGLE speaker giving a talk or presentation in an everyday social context.
- Duration: The transcript must be 900-1100 words total.
- Context: Orientation, guided tour, briefing, announcement, information session, welcome talk, or public presentation.
- Tone: Descriptive and informative. The speaker addresses an audience directly.
- The speaker is labeled "Narrator".
- The monologue should cover multiple sub-topics or areas (e.g., different facilities, different rules, different stages) to allow varied question types.

QUESTION REQUIREMENTS:
- Generate EXACTLY 10 questions.
- Question IDs: s2_q1 through s2_q10.
- Questions MUST progress in transcript order (the answer to q1 appears before the answer to q2 in the transcript, and so on).
- Use at least 2-3 different question types from: multiple_choice_single, matching_features, note_table_flow_completion, sentence_completion, diagram_label_completion.
- Every answer MUST be findable verbatim or near-verbatim in the transcript.
- Answers should be brief: 1-3 words for completions.
- Include specific testable details: names, locations, times, dates, prices, capacities, distances, opening hours, rules, procedures.

QUESTION TYPE SPECIFICATIONS:

1. multiple_choice_single:
   - Provide exactly 3 or 4 options in the "options" array.
   - answerSpec.kind = "single"
   - answerSpec.value = the text of the correct option (must match one option exactly)
   - correctAnswer = same as answerSpec.value

2. matching_features:
   - Provide a list of features/options to match against in the "options" array.
   - Use "groupId" to link related matching questions together.
   - answerSpec.kind = "single"
   - answerSpec.value = the matched option text
   - correctAnswer = same as answerSpec.value

3. note_table_flow_completion / sentence_completion:
   - answerSpec.kind = "single"
   - answerSpec.maxWords = 3
   - answerSpec.caseSensitive = false
   - answerSpec.value = the correct answer string
   - correctAnswer = same as answerSpec.value

4. diagram_label_completion:
   - answerSpec.kind = "single"
   - answerSpec.maxWords = 3
   - answerSpec.caseSensitive = false
   - answerSpec.value = the correct label text
   - correctAnswer = same as answerSpec.value
   - The prompt should describe the position on the diagram (e.g., "Label for the area marked X on the map")

OUTPUT FORMAT:
Return strictly valid JSON with NO markdown fences, NO comments, and NO trailing commas. The JSON must conform to this structure:

{
  "title": "string - descriptive title for this section",
  "topic": "string - the topic/scenario",
  "context": "string - brief description of the situation",
  "speakers": [
    { "label": "Narrator", "gender": "male" | "female" }
  ],
  "transcriptSegments": [
    { "speaker": "Narrator", "text": "..." }
  ],
  "questions": [
    {
      "questionId": "s2_q1",
      "type": "multiple_choice_single" | "matching_features" | "note_table_flow_completion" | "sentence_completion" | "diagram_label_completion",
      "prompt": "string - the question stem or sentence with a blank",
      "instructions": "string (optional) - e.g. 'Write NO MORE THAN THREE WORDS'",
      "groupId": "string (optional) - groups related questions, e.g. 'map_labels' or 'feature_match'",
      "options": ["A", "B", "C"] (for multiple_choice_single and matching_features),
      "answerSpec": {
        "kind": "single",
        "value": "correct answer",
        "caseSensitive": false,
        "maxWords": 3
      },
      "correctAnswer": "correct answer",
      "explanation": "string - why this is correct, referencing the transcript"
    }
  ]
}`;

export const buildUserPrompt = (topic: string, usedTopics: string[]): string =>
  `Generate an IELTS Listening Section 2 monologue on the following topic:

TOPIC: "${topic}"

${usedTopics.length > 0 ? `PREVIOUSLY USED TOPICS (do NOT reuse these scenarios or closely similar situations):
${usedTopics.map(t => `- ${t}`).join('\n')}

` : ''}CRITICAL LENGTH REQUIREMENT — the transcript MUST be 900-1100 words total. This is a HARD requirement. A real IELTS Section 2 lasts 6-7 minutes when read aloud. To achieve this:
- Write 20-35 transcriptSegments.
- Each segment should be a full paragraph of 2-5 sentences (40-80 words each).
- The monologue should cover 5-7 distinct sub-topics or areas in depth (not surface-level mentions).
- Include transitional phrases: "Moving on to...", "Now I'd like to tell you about...", "Another thing to mention is...", "Before I forget...", "You'll also be pleased to know that...".

Create an engaging, informative monologue that a single speaker would deliver to an audience. Structure the talk so it covers several distinct areas, facilities, features, or stages — this enables a variety of question types including matching and diagram labelling. Include at least 10-12 specific factual details (place names, times, dates, prices, distances, capacities, rules, directions) that can be tested. The information should be introduced in a clear sequential order so questions can progress through the transcript.

Return ONLY the JSON object. No markdown, no code fences, no extra text.`;
