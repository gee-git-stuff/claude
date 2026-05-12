/**
 * Basic tests for LinguaChat engine and language data.
 * Run with: node tests/test.js
 */

const fs = require('fs');
const vm = require('vm');

// Create a sandbox with browser-like globals
const sandbox = {
  window: {
    SpeechRecognition: null,
    webkitSpeechRecognition: null,
    speechSynthesis: {
      cancel() {},
      speak() {},
      getVoices() { return []; },
      onvoiceschanged: undefined,
    }
  },
  document: {
    querySelector: () => null,
    querySelectorAll: () => [],
  },
  console,
  setTimeout,
  Date,
  Math,
  Array,
  Object,
  Map,
  Set,
  Promise,
  parseInt,
  parseFloat,
  SpeechSynthesisUtterance: function() {
    this.lang = '';
    this.rate = 1;
    this.pitch = 1;
    this.voice = null;
    this.onend = null;
    this.onerror = null;
  },
  alert: () => {},
};

const context = vm.createContext(sandbox);

// Load source files in order — they assign to global-scope consts
['js/languages.js', 'js/engine.js', 'js/speech.js'].forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  vm.runInContext(code, context);
});

// Extract the modules from the context
const LanguageData = vm.runInContext('LanguageData', context);
const LearningEngine = vm.runInContext('LearningEngine', context);
const Speech = vm.runInContext('Speech', context);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

// === LanguageData Tests ===
console.log('\nLanguageData:');

assert(LanguageData.LANG_NAMES.en === 'English', 'LANG_NAMES has English');
assert(LanguageData.LANG_NAMES.es === 'Spanish', 'LANG_NAMES has Spanish');
assert(LanguageData.LANG_NAMES.ja === 'Japanese', 'LANG_NAMES has Japanese');

assert(LanguageData.SPEECH_CODES.en === 'en-US', 'Speech code for English');
assert(LanguageData.SPEECH_CODES.fr === 'fr-FR', 'Speech code for French');

const beginnerVocab = LanguageData.getVocabForLevel('beginner');
assert(beginnerVocab.length > 0, 'Beginner vocab is not empty');
assert(beginnerVocab[0].en !== undefined, 'Vocab items have English field');
assert(beginnerVocab[0].es !== undefined, 'Vocab items have Spanish field');

const allVocab = LanguageData.getAllVocab('intermediate');
assert(allVocab.length > beginnerVocab.length, 'Intermediate includes beginner vocab');

const advancedVocab = LanguageData.getAllVocab('advanced');
assert(advancedVocab.length >= allVocab.length, 'Advanced includes all lower levels');

assert(LanguageData.translate('hello', 'en', 'es') === 'hola', 'Translate hello -> hola');
assert(LanguageData.translate('water', 'en', 'fr') === 'eau', 'Translate water -> eau');
assert(LanguageData.translate('nonexistent', 'en', 'es') === null, 'Unknown word returns null');

const randomVocab = LanguageData.getRandomVocab('beginner', 'en');
assert(randomVocab !== null, 'Random vocab returns an item');
assert(randomVocab.en !== undefined, 'Random vocab has en field');

const categories = LanguageData.getCategories();
assert(categories.includes('greetings'), 'Categories include greetings');
assert(categories.includes('food'), 'Categories include food');
assert(categories.includes('travel'), 'Categories include travel');

// === LearningEngine Tests ===
console.log('\nLearningEngine:');

vm.runInContext('LearningEngine.init("en", "es", "beginner")', context);
const initState = vm.runInContext('LearningEngine.getState()', context);
assert(initState.nativeLang === 'en', 'Init sets native language');
assert(initState.targetLang === 'es', 'Init sets target language');
assert(initState.difficulty === 'beginner', 'Init sets difficulty');
assert(initState.xp === 0, 'Init XP is 0');
assert(initState.streak === 0, 'Init streak is 0');

// Record correct
const correctResult = vm.runInContext('LearningEngine.recordCorrect("hello")', context);
assert(correctResult.xp === 10, 'Correct answer gives 10 XP');
assert(correctResult.streak === 1, 'Streak incremented to 1');

vm.runInContext('LearningEngine.recordCorrect("world")', context);
vm.runInContext('LearningEngine.recordCorrect("test")', context);
const streakResult = vm.runInContext('LearningEngine.recordCorrect("again")', context);
assert(streakResult.streak === 4, 'Streak is 4 after 4 correct');
assert(streakResult.xp > 40, 'Streak bonus XP added');

// Record wrong
const wrongResult = vm.runInContext('LearningEngine.recordWrong("oops")', context);
assert(wrongResult.streak === 0, 'Wrong answer resets streak');

// Quiz generation
vm.runInContext('LearningEngine.init("en", "es", "beginner")', context);
const quiz = vm.runInContext('LearningEngine.generateTranslationQuiz()', context);
assert(quiz !== null, 'Translation quiz generated');
assert(quiz.question !== undefined, 'Quiz has question');
assert(quiz.answer !== undefined, 'Quiz has answer');
assert(quiz.options.length >= 2, 'Quiz has multiple options');
assert(quiz.options.includes(quiz.answer), 'Options include correct answer');

// Listening quiz
const listenQuiz = vm.runInContext('LearningEngine.generateListeningQuiz()', context);
assert(listenQuiz !== null, 'Listening quiz generated');
assert(listenQuiz.isListening === true, 'Listening quiz flagged');

// Speaking challenge
const speakChallenge = vm.runInContext('LearningEngine.generateSpeakingChallenge()', context);
assert(speakChallenge !== null, 'Speaking challenge generated');
assert(speakChallenge.isSpeaking === true, 'Speaking challenge flagged');
assert(speakChallenge.targetPhrase !== undefined, 'Has target phrase');
assert(speakChallenge.nativeHint !== undefined, 'Has native hint');

// Flashcard
const card = vm.runInContext('LearningEngine.generateFlashcard()', context);
assert(card !== null, 'Flashcard generated');
assert(card.front !== undefined, 'Card has front');
assert(card.back !== undefined, 'Card has back');

// Check answer
vm.runInContext('LearningEngine.init("en", "es", "beginner")', context);
const quiz2 = vm.runInContext('LearningEngine.generateTranslationQuiz()', context);
const checkCorrect = vm.runInContext(`LearningEngine.checkAnswer("${quiz2.answer}")`, context);
assert(checkCorrect.correct === true, 'Correct answer recognized');

const quiz3 = vm.runInContext('LearningEngine.generateTranslationQuiz()', context);
const checkWrong = vm.runInContext('LearningEngine.checkAnswer("definitely_wrong_answer_xyz")', context);
assert(checkWrong.correct === false, 'Wrong answer recognized');
assert(checkWrong.correctAnswer !== undefined, 'Wrong answer shows correct');

// Levenshtein distance
const lev = LearningEngine.levenshtein;
assert(lev('hello', 'hello') === 0, 'Levenshtein same string = 0');
assert(lev('hello', 'hallo') === 1, 'Levenshtein 1 char diff = 1');
assert(lev('', 'abc') === 3, 'Levenshtein empty to abc = 3');
assert(lev('kitten', 'sitting') === 3, 'Levenshtein kitten/sitting = 3');

// Chat processing
vm.runInContext('LearningEngine.init("en", "es", "beginner")', context);
const chatHello = vm.runInContext('LearningEngine.processChat("hello")', context);
assert(chatHello.text.includes('hola'), 'Chat translates hello to hola');

const chatHelp = vm.runInContext('LearningEngine.processChat("help")', context);
assert(chatHelp.text.includes('quiz'), 'Help text mentions quiz');

const chatQuiz = vm.runInContext('LearningEngine.processChat("quiz me")', context);
assert(chatQuiz.quiz !== undefined || chatQuiz.text.includes('What is'), 'Quiz me starts a quiz');

const chatStats = vm.runInContext('LearningEngine.processChat("progress")', context);
assert(chatStats.text.includes('XP'), 'Progress shows XP');

// === Speech Module Tests ===
console.log('\nSpeech:');

assert(typeof Speech.isRecognitionSupported === 'function', 'Has isRecognitionSupported');
assert(typeof Speech.isSynthesisSupported === 'function', 'Has isSynthesisSupported');
assert(typeof Speech.speak === 'function', 'Has speak function');
assert(typeof Speech.startListening === 'function', 'Has startListening function');
assert(typeof Speech.stopListening === 'function', 'Has stopListening function');

// Summary
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
