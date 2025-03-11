const express = require('express');
const router = express.Router();
const db = require('../config/firebase');
const { generateContent, generateQuizId } = require('../utils/contentGenerator');
const admin = require('firebase-admin');

// Create Quiz/Flashcards
router.post('/create_content', async (req, res) => {
    const { text, question_type, num_options, num_questions, include_flashcards, content_name, user_id } = req.body;
    if (!text || !question_type || !content_name || !user_id) {
        return res.status(400).json({ error: 'Text, question_type, content_name, and user_id are required' });
    }
    const numQuestions = Math.min(parseInt(num_questions) || 1, 10);
    const numOptions = Math.min(parseInt(num_options) || 4, 4);

    const content = await generateContent(text, question_type, numOptions, numQuestions, include_flashcards === true);
    const quizId = generateQuizId();

    try {
        console.log('Attempting to write to quizzes collection...');
        console.log('Quiz ID:', quizId);
        await db.collection('quizzes').doc(quizId).set({
          quizId,
          questions: content.questions,
          flashcards: content.flashcards,
          contentName: content_name,
          userId: user_id,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('Write successful');
        res.status(201).json({ 
          quiz_id: quizId,
          quiz_link: `http://localhost:${process.env.PORT}/api/quiz/${quizId}`,
          content_name,
          content 
        });
      } catch (err) {
        console.error('Error saving content:', err);
        res.status(500).json({ error: 'Error saving content', details: err.message });
      }
});

// Get Quiz Data
router.get('/quiz/:quizId', async (req, res) => {
    const { quizId } = req.params;
    try {
        const quizDoc = await db.collection('quizzes').doc(quizId).get();
        if (quizDoc.exists) {
            const data = quizDoc.data();
            res.status(200).json({
                quiz_id: quizId,
                questions: data.questions,
                flashcards: data.flashcards
            });
        } else {
            res.status(404).json({ error: 'Quiz not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Flashcard Data
router.get('/flashcards/:quizId', async (req, res) => {
    const { quizId } = req.params;
    try {
        const quizDoc = await db.collection('quizzes').doc(quizId).get();
        if (quizDoc.exists) {
            const data = quizDoc.data();
            res.status(200).json({
                quiz_id: quizId,
                flashcards: data.flashcards
            });
        } else {
            res.status(404).json({ error: 'Flashcards not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Submit Score
router.post('/submit_score', async (req, res) => {
    const { quizId, playerName, score } = req.body;
    if (!quizId || !playerName || score === undefined) {
        return res.status(400).json({ error: 'Missing required fields: quizId, playerName, score' });
    }
    try {
        await db.collection('scores').add({
            quizId,
            playerName,
            score,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(201).json({ success: true, message: 'Score submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error saving score' });
    }
});

// Get Leaderboard
router.get('/leaderboard/:quizId', async (req, res) => {
    const { quizId } = req.params;
    try {
        const scoresSnapshot = await db.collection('scores')
            .where('quizId', '==', quizId)
            .orderBy('score', 'desc')
            .limit(10)
            .get();
        
        const leaderboard = scoresSnapshot.docs.map(doc => ({
            player_name: doc.data().playerName,
            score: doc.data().score
        }));

        res.status(200).json({
            quiz_id: quizId,
            leaderboard
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Global Recent Content (Public)
router.get('/recent', async (req, res) => {
    try {
        const quizzesSnapshot = await db.collection('quizzes')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        const recentQuizzes = quizzesSnapshot.docs.map(doc => ({
            quiz_id: doc.data().quizId,
            content_name: doc.data().contentName,
            created_at: doc.data().createdAt?.toDate()
        }));

        res.status(200).json(recentQuizzes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching recent content' });
    }
});

// Get User-Specific Recent Content
router.get('/recent/user/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const quizzesSnapshot = await db.collection('quizzes')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        const recentQuizzes = quizzesSnapshot.docs.map(doc => ({
            quiz_id: doc.data().quizId,
            content_name: doc.data().contentName,
            created_at: doc.data().createdAt?.toDate()
        }));

        res.status(200).json(recentQuizzes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching user recent content' });
    }
});

module.exports = router;