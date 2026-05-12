import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const hasValidKey = apiKey && apiKey !== 'your_gemini_api_key_here';

const ai = hasValidKey ? new GoogleGenAI({ apiKey }) : null;

// Helper to safely parse JSON from Gemini's response
const parseJsonResponse = (text: string) => {
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse JSON from AI:', text);
    throw new Error('Invalid AI response format');
  }
};

export const moderateContent = async (text: string) => {
  if (!ai) return { isAppropriate: true, reason: 'AI disabled' };
  
  const prompt = `You are an event moderator AI.
Analyze the following question submitted by an attendee. 
Is it appropriate? It should NOT contain profanity, hate speech, severe insults, or obvious spam.
Return a JSON object with two fields:
"isAppropriate": boolean,
"reason": string (short explanation)

Question: "${text}"`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });
    
    const resultText = response.text;
    if (!resultText) throw new Error('No text returned from Gemini');
    return parseJsonResponse(resultText);
  } catch (error) {
    console.error('AI Moderation error:', error);
    return { isAppropriate: true, reason: 'Error fallback' };
  }
};

export const findSimilarQuestion = async (newQuestion: string, existingQuestions: {id: string, text: string}[]) => {
  if (!ai || existingQuestions.length === 0) return { isDuplicate: false, duplicateOfId: null };

  const prompt = `You are managing a live Q&A session. A new question was just submitted.
Existing questions (ID: Text):
${existingQuestions.map(q => `${q.id}: ${q.text}`).join('\n')}

New question: "${newQuestion}"

Does the new question address the SAME TOPIC or THEME as any existing question? Match on context and intent, not exact wording.

Return JSON:
{
  "isDuplicate": boolean,
  "duplicateOfId": string | null
}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });
    const resultText = response.text;
    if (!resultText) throw new Error('No text returned from Gemini');
    return parseJsonResponse(resultText);
  } catch (error) {
    console.error('AI Duplication check error:', error);
    return { isDuplicate: false, duplicateOfId: null };
  }
};

export const generateSessionSummary = async (sessionData: any) => {
  if (!ai) return "AI features are not enabled. Please configure GEMINI_API_KEY in the environment variables.";

  const prompt = `You are an expert event analyst.
Please generate a comprehensive, well-formatted Markdown summary of the following event session.
Highlight the main themes, summarize the most popular questions and their discussions, and mention any key poll results.

Session Data:
${JSON.stringify(sessionData, null, 2)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });
    return response.text || "An error occurred while generating the summary.";
  } catch (error) {
    console.error('AI Summary error:', error);
    return "An error occurred while generating the summary.";
  }
};

export const clusterQuestions = async (questions: { id: string; text: string }[]) => {
  if (!ai || questions.length < 3) return [];

  const prompt = `You are an AI assistant managing a Q&A session at a live event.
Group the following questions into 3-6 semantic clusters based on their topics.
Each cluster should have a short label (max 3 words), an appropriate emoji, and the list of question IDs that belong to it.
Every question must be assigned to exactly one cluster.

Questions:
${questions.map(q => `${q.id}: ${q.text}`).join('\n')}

Return a JSON array:
[{"label": "Topic Name", "emoji": "🎯", "questionIds": ["id1", "id2"]}]`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });
    const resultText = response.text;
    if (!resultText) throw new Error('No text returned from Gemini');
    return parseJsonResponse(resultText);
  } catch (error: any) {
    console.error('AI Clustering error:', error);
    return [];
  }
};
