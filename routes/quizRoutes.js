const express = require('express');
const router = express.Router();
const db = require('../config/firebase'); // Firebase configuration
const { generateContent, generateQuizId } = require('../utils/contentGenerator');
const admin = require('firebase-admin');

// Create Quiz/Flashcards
router.post('/create_content', async (req, res) => {
    const { text, question_type, num_options, num_questions, include_flashcards, content_name, user_id } = req.body;
    
    // Input validation
    if (!text || !question_type || !content_name || !user_id) {
        return res.status(400).json({ error: 'Text, question_type, content_name, and user_id are required' });
    }

    const numQuestions = Math.min(parseInt(num_questions) || 1, 10);
    const numOptions = Math.min(parseInt(num_options) || 4, 4);

    try {
        // Generate content using existing utility function
        const content = await generateContent(
            text,
            question_type,
            numOptions,
            numQuestions,
            include_flashcards === true
        );

        const quizId = generateQuizId();

        // Save to Firestore
        await db.collection('quizzes').doc(quizId).set({
            quizId,
            questions: content.questions,
            flashcards: content.flashcards,
            contentName: content_name,
            userId: user_id,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({
            quiz_id: quizId,
            quiz_link: `http://localhost:${process.env.PORT}/api/quiz/${quizId}`,
            content_name,
            content
        });
    } catch (err) {
        console.error('Error creating content:', err);
        res.status(500).json({ error: 'Error creating content', details: err.message });
    }
});

// Get Quiz Data
router.get('/quiz/:quizId', async (req, res) => {
    const { quizId } = req.params;
    
    try {
        const quizDoc = await db.collection('quizzes').doc(quizId).get();
        
        if (!quizDoc.exists) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        const data = quizDoc.data();
        res.status(200).json({
            quiz_id: quizId,
            questions: data.questions,
            flashcards: data.flashcards
        });
    } catch (err) {
        console.error('Error fetching quiz:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get Flashcard Data
router.get('/flashcards/:quizId', async (req, res) => {
    const { quizId } = req.params;
    
    try {
        const quizDoc = await db.collection('quizzes').doc(quizId).get();
        
        if (!quizDoc.exists) {
            return res.status(404).json({ error: 'Flashcards not found' });
        }

        const data = quizDoc.data();
        res.status(200).json({
            quiz_id: quizId,
            flashcards: data.flashcards
        });
    } catch (err) {
        console.error('Error fetching flashcards:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Submit Score
router.post('/submit_score', async (req, res) => {
    const { quizId, playerName, score } = req.body;
    
    if (!quizId || !playerName || score === undefined) {
        return res.status(400).json({ error: 'Missing required fields: quizId, playerName, score' });
    }

    try {
        const scoreRef = await db.collection('scores').add({
            quizId,
            playerName,
            score,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({
            success: true,
            message: 'Score submitted successfully',
            scoreId: scoreRef.id
        });
    } catch (err) {
        console.error('Error saving score:', err);
        res.status(500).json({ error: 'Error saving score', details: err.message });
    }
});

// Get Leaderboard
router.get('/leaderboard/:quizId', async (req, res) => {
    const { quizId } = req.params;
    
    try {
        // Verify quiz exists
        const quizDoc = await db.collection('quizzes').doc(quizId).get();
        if (!quizDoc.exists) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        // Get top 10 scores
        const scoresSnapshot = await db.collection('scores')
            .where('quizId', '==', quizId)
            .orderBy('score', 'desc')
            .orderBy('createdAt', 'asc')
            .limit(10)
            .get();

        const leaderboard = scoresSnapshot.docs.map(doc => ({
            scoreId: doc.id,
            playerName: doc.data().playerName,
            score: doc.data().score,
            createdAt: doc.data().createdAt?.toDate()
        }));

        res.status(200).json({
            quizId,
            leaderboard
        });
    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        res.status(500).json({ error: 'Error fetching leaderboard', details: err.message });
    }
});

// Get User Scores
router.get('/scores/user/:userId', async (req, res) => {
    const { userId } = req.params;
    const { quizId } = req.query; // Optional quizId filter
    
    try {
        let query = db.collection('scores')
            .where('playerName', '==', userId);

        if (quizId) {
            query = query.where('quizId', '==', quizId);
        }

        const scoresSnapshot = await query
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const userScores = scoresSnapshot.docs.map(doc => ({
            scoreId: doc.id,
            quizId: doc.data().quizId,
            playerName: doc.data().playerName,
            score: doc.data().score,
            createdAt: doc.data().createdAt?.toDate()
        }));

        res.status(200).json({
            userId,
            quizId: quizId || 'all',
            scores: userScores
        });
    } catch (err) {
        console.error('Error fetching user scores:', err);
        res.status(500).json({ error: 'Error fetching user scores', details: err.message });
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
        console.error('Error fetching recent content:', err);
        res.status(500).json({ error: 'Error fetching recent content', details: err.message });
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
        console.error('Error fetching user recent content:', err);
        res.status(500).json({ error: 'Error fetching user recent content', details: err.message });
    }
});

module.exports = router;
