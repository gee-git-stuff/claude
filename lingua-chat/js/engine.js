/**
 * LinguaChat Learning Engine
 * Handles adaptive difficulty, progress tracking, quiz generation, and chatbot logic.
 */
const LearningEngine = (() => {
  let state = {
    nativeLang: 'en',
    targetLang: 'es',
    difficulty: 'beginner',
    xp: 0,
    streak: 0,
    bestStreak: 0,
    wordsLearned: new Set(),
    wordScores: {},     // word -> { correct, wrong, lastSeen }
    sessionHistory: [], // recent interactions
    currentQuiz: null,
    mode: 'chat',       // chat | flashcard | listen | speak
  };

  const XP_PER_CORRECT = 10;
  const XP_PER_STREAK_BONUS = 5;
  const LEVEL_UP_THRESHOLD = { beginner: 150, intermediate: 400 };

  function init(nativeLang, targetLang, difficulty) {
    state.nativeLang = nativeLang;
    state.targetLang = targetLang;
    state.difficulty = difficulty;
    state.xp = 0;
    state.streak = 0;
    state.wordsLearned = new Set();
    state.wordScores = {};
    state.sessionHistory = [];
  }

  function getState() {
    return { ...state };
  }

  function setMode(mode) {
    state.mode = mode;
  }

  function addXP(amount) {
    state.xp += amount;
    checkLevelUp();
    return state.xp;
  }

  function recordCorrect(word) {
    state.streak++;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    const bonus = state.streak >= 3 ? XP_PER_STREAK_BONUS : 0;
    addXP(XP_PER_CORRECT + bonus);
    state.wordsLearned.add(word);
    if (!state.wordScores[word]) state.wordScores[word] = { correct: 0, wrong: 0, lastSeen: 0 };
    state.wordScores[word].correct++;
    state.wordScores[word].lastSeen = Date.now();
    return { xp: state.xp, streak: state.streak, bonus };
  }

  function recordWrong(word) {
    state.streak = 0;
    if (!state.wordScores[word]) state.wordScores[word] = { correct: 0, wrong: 0, lastSeen: 0 };
    state.wordScores[word].wrong++;
    state.wordScores[word].lastSeen = Date.now();
    return { xp: state.xp, streak: 0 };
  }

  function checkLevelUp() {
    const threshold = LEVEL_UP_THRESHOLD[state.difficulty];
    if (threshold && state.xp >= threshold) {
      if (state.difficulty === 'beginner') {
        state.difficulty = 'intermediate';
        return 'intermediate';
      } else if (state.difficulty === 'intermediate') {
        state.difficulty = 'advanced';
        return 'advanced';
      }
    }
    return null;
  }

  // Get words the user struggles with
  function getWeakWords() {
    return Object.entries(state.wordScores)
      .filter(([_, s]) => s.wrong > s.correct || s.correct < 2)
      .map(([word]) => word);
  }

  // Pick a word, biased towards weak words
  function pickStudyWord() {
    const weak = getWeakWords();
    if (weak.length > 0 && Math.random() < 0.6) {
      const word = weak[Math.floor(Math.random() * weak.length)];
      const allVocab = LanguageData.getAllVocab(state.difficulty);
      return allVocab.find(v => v[state.nativeLang] === word || v[state.targetLang] === word) || LanguageData.getRandomVocab(state.difficulty);
    }
    return LanguageData.getRandomVocab(state.difficulty);
  }

  // Generate a translation quiz
  function generateTranslationQuiz() {
    const item = pickStudyWord();
    if (!item) return null;

    // Random direction: native->target or target->native
    const toTarget = Math.random() < 0.5;
    const question = toTarget ? item[state.nativeLang] : item[state.targetLang];
    const answer = toTarget ? item[state.targetLang] : item[state.nativeLang];

    // Generate wrong options
    const allVocab = LanguageData.getVocabForLevel(state.difficulty);
    const answerLang = toTarget ? state.targetLang : state.nativeLang;
    const options = [answer];

    const shuffled = [...allVocab].sort(() => Math.random() - 0.5);
    for (const v of shuffled) {
      if (options.length >= 4) break;
      const opt = v[answerLang];
      if (opt && !options.includes(opt)) options.push(opt);
    }

    // Shuffle options
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    state.currentQuiz = { question, answer, options, toTarget, item };
    return state.currentQuiz;
  }

  // Generate a listening quiz (hear word, pick meaning)
  function generateListeningQuiz() {
    const item = pickStudyWord();
    if (!item) return null;

    const spokenWord = item[state.targetLang];
    const answer = item[state.nativeLang];

    const allVocab = LanguageData.getVocabForLevel(state.difficulty);
    const options = [answer];
    const shuffled = [...allVocab].sort(() => Math.random() - 0.5);
    for (const v of shuffled) {
      if (options.length >= 4) break;
      const opt = v[state.nativeLang];
      if (opt && !options.includes(opt)) options.push(opt);
    }
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    state.currentQuiz = { question: spokenWord, answer, options, item, isListening: true };
    return state.currentQuiz;
  }

  // Generate a speaking challenge
  function generateSpeakingChallenge() {
    const item = pickStudyWord();
    if (!item) return null;
    state.currentQuiz = {
      targetPhrase: item[state.targetLang],
      nativeHint: item[state.nativeLang],
      item,
      isSpeaking: true
    };
    return state.currentQuiz;
  }

  // Generate a flashcard
  function generateFlashcard() {
    const item = pickStudyWord();
    if (!item) return null;
    return {
      front: item[state.targetLang],
      back: item[state.nativeLang],
      item
    };
  }

  // Check a free-text answer
  function checkAnswer(userInput) {
    if (!state.currentQuiz) return { correct: false, message: 'No active quiz.' };

    const normalized = userInput.toLowerCase().trim();
    const expected = state.currentQuiz.answer.toLowerCase().trim();

    if (normalized === expected) {
      const result = recordCorrect(expected);
      state.currentQuiz = null;
      return { correct: true, ...result };
    }

    // Fuzzy match: allow small typos (Levenshtein distance <= 2 for words > 4 chars)
    if (expected.length > 4 && levenshtein(normalized, expected) <= 2) {
      const result = recordCorrect(expected);
      state.currentQuiz = null;
      return { correct: true, closeMatch: true, expected, ...result };
    }

    const result = recordWrong(state.currentQuiz.answer);
    const correctAnswer = state.currentQuiz.answer;
    state.currentQuiz = null;
    return { correct: false, correctAnswer, ...result };
  }

  // Check spoken input against target phrase
  function checkSpokenInput(spokenText) {
    if (!state.currentQuiz || !state.currentQuiz.isSpeaking) {
      return { correct: false, message: 'No active speaking challenge.' };
    }

    const normalized = spokenText.toLowerCase().trim();
    const expected = state.currentQuiz.targetPhrase.toLowerCase().trim();

    if (normalized === expected || levenshtein(normalized, expected) <= Math.max(2, Math.floor(expected.length * 0.2))) {
      const result = recordCorrect(expected);
      const targetPhrase = state.currentQuiz.targetPhrase;
      state.currentQuiz = null;
      return { correct: true, targetPhrase, ...result };
    }

    const targetPhrase = state.currentQuiz.targetPhrase;
    recordWrong(expected);
    return { correct: false, expected: targetPhrase, heard: spokenText };
  }

  // Process free chat input and generate a response
  function processChat(userMessage) {
    const msg = userMessage.toLowerCase().trim();
    const targetName = LanguageData.LANG_NAMES[state.targetLang];

    // Try to translate user input
    const translated = LanguageData.translate(msg, state.nativeLang, state.targetLang);
    if (translated) {
      recordCorrect(msg);
      return {
        text: `"${userMessage}" in ${targetName} is: **${translated}**`,
        translation: translated,
        speakText: translated,
        speakLang: state.targetLang
      };
    }

    // Check if user typed in target language
    const reverseTranslated = LanguageData.translate(msg, state.targetLang, state.nativeLang);
    if (reverseTranslated) {
      recordCorrect(msg);
      return {
        text: `"${userMessage}" means: **${reverseTranslated}**. Great use of ${targetName}!`,
        translation: reverseTranslated,
        speakText: userMessage,
        speakLang: state.targetLang
      };
    }

    // Check for commands
    if (msg === 'help' || msg === '?') {
      return {
        text: `Here's what you can do:\n• Type a word to translate it\n• Say "quiz me" for a translation quiz\n• Say "teach me" for a new word\n• Use the mode buttons above for flashcards, listening, and speaking practice\n• Click 🔊 on any message to hear pronunciation`,
      };
    }

    if (msg.includes('quiz') || msg.includes('test')) {
      const quiz = generateTranslationQuiz();
      if (!quiz) return { text: 'No quiz available right now.' };
      return {
        text: `What is "${quiz.question}" in ${quiz.toTarget ? targetName : LanguageData.LANG_NAMES[state.nativeLang]}?`,
        quiz
      };
    }

    if (msg.includes('teach') || msg.includes('learn') || msg.includes('new word')) {
      const item = pickStudyWord();
      if (!item) return { text: 'I don\'t have more words for now!' };
      const word = item[state.targetLang];
      const meaning = item[state.nativeLang];
      return {
        text: `New word: **${word}** means "${meaning}"`,
        speakText: word,
        speakLang: state.targetLang,
        hint: `Try using "${word}" in your next message!`
      };
    }

    if (msg.includes('progress') || msg.includes('stats') || msg.includes('score')) {
      return {
        text: `📊 Your progress:\n• XP: ${state.xp}\n• Words learned: ${state.wordsLearned.size}\n• Best streak: ${state.bestStreak}\n• Level: ${state.difficulty}\n\nKeep going!`
      };
    }

    // If we have an active quiz, treat input as an answer
    if (state.currentQuiz && !state.currentQuiz.isSpeaking && !state.currentQuiz.isListening) {
      const result = checkAnswer(userMessage);
      if (result.correct) {
        const extra = result.closeMatch ? ` (close! The exact spelling is "${result.expected}")` : '';
        return {
          text: `Correct!${extra} +${XP_PER_CORRECT} XP${result.bonus ? ` (+${result.bonus} streak bonus!)` : ''}`,
          correct: true
        };
      }
      return {
        text: `Not quite. The answer was: **${result.correctAnswer}**`,
        correction: result.correctAnswer,
        correct: false
      };
    }

    // Default: teach a contextual word and ask a question
    const item = pickStudyWord();
    if (item) {
      const word = item[state.targetLang];
      const meaning = item[state.nativeLang];
      const quiz = generateTranslationQuiz();
      if (quiz) {
        return {
          text: `Let me teach you: **${word}** = "${meaning}"\n\nNow, what is "${quiz.question}" in ${quiz.toTarget ? targetName : LanguageData.LANG_NAMES[state.nativeLang]}?`,
          speakText: word,
          speakLang: state.targetLang,
          quiz
        };
      }
    }

    return {
      text: `I'm not sure about that one. Try typing a word to translate, or say "quiz me"!`
    };
  }

  // Levenshtein distance for fuzzy matching
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  return {
    init,
    getState,
    setMode,
    addXP,
    recordCorrect,
    recordWrong,
    generateTranslationQuiz,
    generateListeningQuiz,
    generateSpeakingChallenge,
    generateFlashcard,
    checkAnswer,
    checkSpokenInput,
    processChat,
    getWeakWords,
    levenshtein
  };
})();
