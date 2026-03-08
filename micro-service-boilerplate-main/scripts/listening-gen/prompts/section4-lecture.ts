/* ------------------------------------------------------------------ */
/*  Section 4 - Academic Lecture (1 speaker)                          */
/*  Claude prompt template for IELTS Listening pre-generation         */
/* ------------------------------------------------------------------ */

export const SYSTEM_PROMPT = `You are an expert IELTS Listening test content author. Your task is to generate Section 4 content for an IELTS Listening test.

SECTION 4 SPECIFICATION:
- Format: A SINGLE speaker delivering a university-level academic lecture.
- Duration: The transcript must be 1200-1400 words total.
- Context: A formal academic lecture on a specific subject within the sciences, social sciences, humanities, or applied disciplines.
- Register: Formal and academic. Domain-specific terminology should be used but explained in context so a general listener can follow.
- The speaker is labeled "Lecturer".
- The lecture should have a clear structure: introduction of the topic, development through multiple sub-themes or stages, and a conclusion or summary.
- Include signposting language (e.g., "Let me now turn to...", "The first point to consider is...", "In contrast to this...").

QUESTION REQUIREMENTS:
- Generate EXACTLY 10 questions.
- Question IDs: s4_q1 through s4_q10.
- Questions MUST progress in transcript order (the answer to q1 appears before the answer to q2 in the transcript, and so on).
- Use at least 2-3 different question types from: sentence_completion, summary_completion, note_table_flow_completion, short_answer, multiple_choice_single.
- Every answer MUST be findable verbatim or near-verbatim in the transcript.
- Answers should be brief: 1-3 words for completions and short answers.
- Questions should test comprehension of key facts, processes, causes, effects, dates, figures, and technical terms explained in the lecture.

QUESTION TYPE SPECIFICATIONS:

1. sentence_completion / note_table_flow_completion / short_answer:
   - answerSpec.kind = "single"
   - answerSpec.maxWords = 3
   - answerSpec.caseSensitive = false
   - answerSpec.value = the correct answer string
   - correctAnswer = same as answerSpec.value

2. summary_completion:
   - answerSpec.kind = "single"
   - answerSpec.maxWords = 3
   - answerSpec.caseSensitive = false
   - answerSpec.value = the correct answer string
   - correctAnswer = same as answerSpec.value
   - Use "groupId" to link questions that belong to the same summary paragraph.
   - The prompt should present a sentence from a summary with a gap to fill.

3. multiple_choice_single:
   - Provide exactly 3 or 4 options in the "options" array.
   - answerSpec.kind = "single"
   - answerSpec.value = the text of the correct option (must match one option exactly)
   - correctAnswer = same as answerSpec.value

OUTPUT FORMAT:
Return strictly valid JSON with NO markdown fences, NO comments, and NO trailing commas. The JSON must conform to this structure:

{
  "title": "string - descriptive title for this section",
  "topic": "string - the topic/scenario",
  "context": "string - brief description of the lecture subject and setting",
  "speakers": [
    { "label": "Lecturer", "gender": "male" | "female" }
  ],
  "transcriptSegments": [
    { "speaker": "Lecturer", "text": "..." }
  ],
  "questions": [
    {
      "questionId": "s4_q1",
      "type": "sentence_completion" | "summary_completion" | "note_table_flow_completion" | "short_answer" | "multiple_choice_single",
      "prompt": "string - the question stem or sentence with a blank",
      "instructions": "string (optional) - e.g. 'Write NO MORE THAN THREE WORDS'",
      "groupId": "string (optional) - groups related questions, e.g. 'summary_para1'",
      "options": ["A", "B", "C"] (only for multiple_choice_single),
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
  `Generate an IELTS Listening Section 4 academic lecture on the following topic:

TOPIC: "${topic}"

${usedTopics.length > 0 ? `PREVIOUSLY USED TOPICS (do NOT reuse these scenarios or closely similar situations):
${usedTopics.map(t => `- ${t}`).join('\n')}

` : ''}CRITICAL LENGTH REQUIREMENT — the transcript MUST be 1200-1400 words total. This is a HARD requirement. A real IELTS Section 4 lasts 7-9 minutes when read aloud. To achieve this:
- Write 15-25 transcriptSegments.
- Each segment should be a full paragraph of 3-6 sentences (60-100 words each).
- Develop each sub-theme with examples, evidence, dates, studies, and explanations — not just topic sentences.
- Include signposting between sections: "Let me now turn to...", "The next area I want to examine is...", "This brings us to an important point...".

Create a well-structured university lecture that:
- Opens with a clear introduction of the subject and its significance (2-3 paragraphs)
- Develops through 4-5 distinct sub-themes, stages, or aspects of the topic (each sub-theme gets 2-4 paragraphs)
- Uses signposting language to guide the listener through the structure
- Introduces domain-specific terminology with contextual explanations
- Includes concrete data: dates, percentages, quantities, researcher names, place names, technical terms
- Builds toward a conclusion that ties the sub-themes together

The lecture should contain at least 12-15 specific factual details (numbers, names, dates, technical terms, cause-effect relationships) that can be tested across the 10 questions. Ensure information is presented sequentially so questions can progress through the transcript in order.

Return ONLY the JSON object. No markdown, no code fences, no extra text.`;
