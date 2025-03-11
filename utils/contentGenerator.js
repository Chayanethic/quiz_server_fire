const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const generateQuizId = () => Math.random().toString(36).substr(2, 6);

const generateContent = async (text, qType, numOptions, numQuestions, includeFlashcards) => {
    try {
        const prompt = `
Generate exactly ${numQuestions} quiz questions and ${includeFlashcards ? 'flashcards ' : ''}based on this text: "${text}". 
Quiz type: "${qType}" (true_false, multiple_choice, or mix). 
For multiple_choice, provide ${numOptions} options, one correct. 
Return in JSON format, no extra text or markdown:
{
    "questions": [
        {"question": "Text", "type": "true_false or multiple_choice", "options": ["opt1", ...] (for multiple_choice), "answer": "correct"}
    ],
    "flashcards": [
        {"term": "Term", "definition": "Definition"}
    ]
}
`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const content = JSON.parse(responseText);
        return {
            questions: content.questions || [],
            flashcards: includeFlashcards ? (content.flashcards || []) : []
        };
    } catch (error) {
        console.error('Error generating content:', error);
        return {
            questions: [{ question: 'Error occurred. Is this a test?', type: 'true_false', answer: 'True' }],
            flashcards: includeFlashcards ? [{ term: 'Error', definition: 'Try again later' }] : []
        };
    }
};

module.exports = { generateContent, generateQuizId };
