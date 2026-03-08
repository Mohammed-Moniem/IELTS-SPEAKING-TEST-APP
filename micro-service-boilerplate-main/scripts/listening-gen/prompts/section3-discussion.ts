/* ------------------------------------------------------------------ */
/*  Section 3 - Educational Discussion (2-3 speakers)                 */
/*  Claude prompt template for IELTS Listening pre-generation         */
/* ------------------------------------------------------------------ */

export const SYSTEM_PROMPT = `You are an expert IELTS Listening test content author. Your task is to generate Section 3 content for an IELTS Listening test.

SECTION 3 SPECIFICATION:
- Format: A discussion between 2-3 speakers in an educational or training context.
- Duration: The transcript must be 1000-1200 words total.
- Context: Tutorial discussion, group project planning, research methodology debate, seminar feedback, course selection, or academic consultation.
- Vocabulary: Academic but accessible. Speakers express opinions, agree, disagree, suggest alternatives, weigh pros and cons.
- Speakers are labeled "Student A", "Student B", and optionally "Tutor", "Professor", or "Student C".
- The conversation should involve genuine exchange of ideas with speakers building on or challenging each other's points.

QUESTION REQUIREMENTS:
- Generate EXACTLY 10 questions.
- Question IDs: s3_q1 through s3_q10.
- Questions MUST progress in transcript order (the answer to q1 appears before the answer to q2 in the transcript, and so on).
- Use at least 2-3 different question types from: multiple_choice_single, multiple_choice_multiple, matching_features, sentence_completion, short_answer.
- Every answer MUST be findable verbatim or near-verbatim in the transcript.
- Answers should be brief: 1-3 words for completions and short answers.
- Questions should test understanding of opinions, reasons, plans, comparisons, and conclusions rather than just surface facts.

QUESTION TYPE SPECIFICATIONS:

1. multiple_choice_single:
   - Provide exactly 3 or 4 options in the "options" array.
   - answerSpec.kind = "single"
   - answerSpec.value = the text of the correct option (must match one option exactly)
   - correctAnswer = same as answerSpec.value

2. multiple_choice_multiple:
   - Provide exactly 5 options in the "options" array.
   - answerSpec.kind = "multi"
   - answerSpec.value = array of correct option texts (typically 2-3 correct answers)
   - correctAnswer = the correct options joined by ", "
   - instructions = "Choose TWO/THREE letters" (as appropriate)

3. matching_features:
   - Provide a list of features/options to match against in the "options" array.
   - Use "groupId" to link related matching questions together.
   - answerSpec.kind = "single"
   - answerSpec.value = the matched option text
   - correctAnswer = same as answerSpec.value

4. sentence_completion / short_answer:
   - answerSpec.kind = "single"
   - answerSpec.maxWords = 3
   - answerSpec.caseSensitive = false
   - answerSpec.value = the correct answer string
   - correctAnswer = same as answerSpec.value

OUTPUT FORMAT:
Return strictly valid JSON with NO markdown fences, NO comments, and NO trailing commas. The JSON must conform to this structure:

{
  "title": "string - descriptive title for this section",
  "topic": "string - the topic/scenario",
  "context": "string - brief description of the situation",
  "speakers": [
    { "label": "Student A", "gender": "male" | "female" },
    { "label": "Student B", "gender": "male" | "female" },
    { "label": "Tutor" | "Professor" | "Student C", "gender": "male" | "female" }
  ],
  "transcriptSegments": [
    { "speaker": "Student A", "text": "..." },
    { "speaker": "Student B", "text": "..." },
    { "speaker": "Tutor", "text": "..." }
  ],
  "questions": [
    {
      "questionId": "s3_q1",
      "type": "multiple_choice_single" | "multiple_choice_multiple" | "matching_features" | "sentence_completion" | "short_answer",
      "prompt": "string - the question stem or sentence with a blank",
      "instructions": "string (optional) - e.g. 'Choose TWO letters'",
      "groupId": "string (optional) - groups related questions",
      "options": ["A", "B", "C", "D", "E"] (for MCQ and matching),
      "answerSpec": {
        "kind": "single" | "multi",
        "value": "correct answer" | ["answer1", "answer2"],
        "caseSensitive": false,
        "maxWords": 3
      },
      "correctAnswer": "correct answer",
      "explanation": "string - why this is correct, referencing the transcript"
    }
  ]
}`;

export const buildUserPrompt = (topic: string, usedTopics: string[]): string =>
  `Generate an IELTS Listening Section 3 educational discussion on the following topic:

TOPIC: "${topic}"

${usedTopics.length > 0 ? `PREVIOUSLY USED TOPICS (do NOT reuse these scenarios or closely similar situations):
${usedTopics.map(t => `- ${t}`).join('\n')}

` : ''}CRITICAL LENGTH REQUIREMENT — the transcript MUST be 1000-1200 words total. This is a HARD requirement. A real IELTS Section 3 lasts 6-8 minutes when read aloud. To achieve this:
- Write 35-55 transcriptSegments (multiple speakers exchanging turns frequently).
- Each segment should be 1-4 sentences (20-60 words each).
- Speakers should build on each other's points: "That's a good point, but I think...", "I agree with what you said about..., however...", "Going back to what [Speaker] mentioned earlier...".
- Include extended reasoning, not just short statements.

Create a realistic academic discussion where speakers express and defend different viewpoints, evaluate options, and reach conclusions. The conversation should demonstrate critical thinking and include:
- Opinions with supporting reasons (not just "I agree" or "I disagree")
- Comparisons between approaches, methods, or options
- Agreement and disagreement between speakers with elaboration
- References to specific studies, data, methods, or academic concepts
- Clear decisions or plans that emerge from the discussion

Include enough specific detail (researcher names, percentages, method names, timeframes, criteria) so that 10 questions can test comprehension of both factual content and speaker attitudes/opinions. Ensure information is introduced sequentially so questions progress through the transcript.

Return ONLY the JSON object. No markdown, no code fences, no extra text.`;
