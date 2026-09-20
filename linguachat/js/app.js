/**
 * LinguaChat - Main application logic
 * Wires together the UI, learning engine, and speech modules.
 */
(() => {
  // DOM references
  const $ = (sel) => document.querySelector(sel);
  const setupScreen = $('#setup-screen');
  const chatScreen = $('#chat-screen');
  const nativeLangSel = $('#native-lang');
  const targetLangSel = $('#target-lang');
  const difficultySel = $('#difficulty');
  const startBtn = $('#start-btn');
  const backBtn = $('#back-btn');
  const headerLang = $('#header-lang');
  const headerLevel = $('#header-level');
  const xpDisplay = $('#xp-display');
  const streakDisplay = $('#streak-display');
  const messagesDiv = $('#messages');
  const chatArea = $('#chat-area');
  const flashcardArea = $('#flashcard-area');
  const msgInput = $('#msg-input');
  const sendBtn = $('#send-btn');
  const micBtn = $('#mic-btn');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const flashcard = $('#flashcard');
  const cardFrontText = $('#card-front-text');
  const cardBackText = $('#card-back-text');
  const cardSpeakBtn = $('#card-speak-btn');
  const cardFlipBtn = $('#card-flip');
  const cardHardBtn = $('#card-hard');
  const cardEasyBtn = $('#card-easy');

  let currentCard = null;

  // Initialize
  Speech.preloadVoices();

  // Prevent choosing same language for native and target
  nativeLangSel.addEventListener('change', syncLangSelects);
  targetLangSel.addEventListener('change', syncLangSelects);

  function syncLangSelects() {
    if (nativeLangSel.value === targetLangSel.value) {
      const options = [...targetLangSel.options].map(o => o.value);
      const alt = options.find(o => o !== nativeLangSel.value);
      if (alt) targetLangSel.value = alt;
    }
  }

  // Start session
  startBtn.addEventListener('click', () => {
    const native = nativeLangSel.value;
    const target = targetLangSel.value;
    const diff = difficultySel.value;

    if (native === target) {
      alert('Please select different languages.');
      return;
    }

    LearningEngine.init(native, target, diff);
    showScreen('chat');
    updateHeader();

    // Welcome message
    const targetName = LanguageData.LANG_NAMES[target];
    addBotMessage(
      `Welcome to LinguaChat! Let's learn ${targetName} together.\n\n` +
      `You can:\n` +
      `• Type words to translate them\n` +
      `• Say "quiz me" for a quiz\n` +
      `• Say "teach me" for new vocabulary\n` +
      `• Use 🎤 to speak\n` +
      `• Try the different modes above!\n\n` +
      `Let's start — how do you say "hello" in ${targetName}?`
    );

    const quiz = LearningEngine.generateTranslationQuiz();
    msgInput.focus();
  });

  backBtn.addEventListener('click', () => {
    showScreen('setup');
  });

  function showScreen(name) {
    setupScreen.classList.toggle('active', name === 'setup');
    chatScreen.classList.toggle('active', name === 'chat');
  }

  function updateHeader() {
    const st = LearningEngine.getState();
    headerLang.textContent = `${LanguageData.LANG_NAMES[st.nativeLang]} → ${LanguageData.LANG_NAMES[st.targetLang]}`;
    headerLevel.textContent = st.difficulty;
    updateStats();
  }

  function updateStats() {
    const st = LearningEngine.getState();
    xpDisplay.textContent = `${st.xp} XP`;
    streakDisplay.textContent = `🔥 ${st.streak}`;
  }

  // Mode switching
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      LearningEngine.setMode(mode);
      switchMode(mode);
    });
  });

  function switchMode(mode) {
    chatArea.classList.toggle('hidden', mode === 'flashcard');
    flashcardArea.classList.toggle('hidden', mode !== 'flashcard');
    $('#input-area').classList.toggle('hidden', mode === 'flashcard');

    if (mode === 'flashcard') {
      nextFlashcard();
    } else if (mode === 'listen') {
      startListenMode();
    } else if (mode === 'speak') {
      startSpeakMode();
    }
  }

  // === CHAT MODE ===
  sendBtn.addEventListener('click', sendMessage);
  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    addUserMessage(text);
    msgInput.value = '';

    // Show typing indicator briefly
    const typing = addTypingIndicator();

    setTimeout(() => {
      typing.remove();
      const response = LearningEngine.processChat(text);
      handleBotResponse(response);
      updateStats();
    }, 400 + Math.random() * 400);
  }

  function handleBotResponse(response) {
    const msgEl = addBotMessage(response.text);

    if (response.translation) {
      const transEl = document.createElement('span');
      transEl.className = 'translation';
      transEl.textContent = response.translation;
      msgEl.appendChild(transEl);
    }

    if (response.correction) {
      const corrEl = document.createElement('span');
      corrEl.className = 'correction';
      corrEl.textContent = `Correct answer: ${response.correction}`;
      msgEl.appendChild(corrEl);
    }

    if (response.hint) {
      const hintEl = document.createElement('span');
      hintEl.className = 'hint';
      hintEl.textContent = response.hint;
      msgEl.appendChild(hintEl);
    }

    if (response.quiz) {
      addQuizOptions(response.quiz);
    }

    if (response.speakText) {
      Speech.speak(response.speakText, response.speakLang || LearningEngine.getState().targetLang);
    }

    // Check for level up
    const st = LearningEngine.getState();
    updateHeader();
  }

  function addUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'message user';
    div.textContent = text;
    addSpeakButton(div, text, LearningEngine.getState().targetLang);
    messagesDiv.appendChild(div);
    scrollToBottom();
    return div;
  }

  function addBotMessage(text) {
    const div = document.createElement('div');
    div.className = 'message bot';
    // Support basic markdown bold
    div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    addSpeakButton(div, text.replace(/\*\*/g, ''), LearningEngine.getState().targetLang);
    messagesDiv.appendChild(div);
    scrollToBottom();
    return div;
  }

  function addSpeakButton(msgEl, text, lang) {
    const btn = document.createElement('button');
    btn.className = 'speak-btn';
    btn.textContent = '🔊';
    btn.title = 'Listen';
    btn.addEventListener('click', () => {
      Speech.speak(text, lang);
    });
    msgEl.appendChild(btn);
  }

  function addQuizOptions(quiz) {
    const container = document.createElement('div');
    container.className = 'message bot';
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'quiz-options';

    quiz.options.forEach(option => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option';
      btn.textContent = option;
      btn.addEventListener('click', () => {
        // Disable all options
        optionsDiv.querySelectorAll('.quiz-option').forEach(b => {
          b.disabled = true;
          if (b.textContent === quiz.answer) b.classList.add('correct');
        });

        if (option === quiz.answer) {
          btn.classList.add('correct');
          const result = LearningEngine.recordCorrect(quiz.answer);
          addBotMessage(`Correct! +${10} XP${result.streak >= 3 ? ' (+5 streak bonus!)' : ''}`);
        } else {
          btn.classList.add('wrong');
          LearningEngine.recordWrong(quiz.answer);
          addBotMessage(`Not quite. The answer was: **${quiz.answer}**`);
        }
        updateStats();

        // Auto-generate next quiz after a delay
        setTimeout(() => {
          const st = LearningEngine.getState();
          if (st.mode === 'listen') {
            startListenMode();
          }
        }, 1500);
      });
      optionsDiv.appendChild(btn);
    });

    container.appendChild(optionsDiv);
    messagesDiv.appendChild(container);
    scrollToBottom();
  }

  function addTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'message bot typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesDiv.appendChild(div);
    scrollToBottom();
    return div;
  }

  function scrollToBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  // === FLASHCARD MODE ===
  function nextFlashcard() {
    const card = LearningEngine.generateFlashcard();
    if (!card) return;
    currentCard = card;
    cardFrontText.textContent = card.front;
    cardBackText.textContent = card.back;
    flashcard.classList.remove('flipped');
  }

  cardFlipBtn.addEventListener('click', () => {
    flashcard.classList.toggle('flipped');
  });

  flashcard.addEventListener('click', () => {
    flashcard.classList.toggle('flipped');
  });

  cardSpeakBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentCard) {
      Speech.speak(currentCard.front, LearningEngine.getState().targetLang);
    }
  });

  cardEasyBtn.addEventListener('click', () => {
    if (currentCard) {
      LearningEngine.recordCorrect(currentCard.front);
      updateStats();
    }
    nextFlashcard();
  });

  cardHardBtn.addEventListener('click', () => {
    if (currentCard) {
      LearningEngine.recordWrong(currentCard.front);
      updateStats();
    }
    nextFlashcard();
  });

  // === LISTEN MODE ===
  function startListenMode() {
    const quiz = LearningEngine.generateListeningQuiz();
    if (!quiz) return;

    addBotMessage(`🎧 Listen carefully and pick the correct meaning:`);
    Speech.speak(quiz.question, LearningEngine.getState().targetLang);

    // Add a replay button
    const replayMsg = addBotMessage(`Click to replay: 🔊`);
    replayMsg.style.cursor = 'pointer';
    replayMsg.addEventListener('click', () => {
      Speech.speak(quiz.question, LearningEngine.getState().targetLang);
    });

    addQuizOptions(quiz);
  }

  // === SPEAK MODE ===
  function startSpeakMode() {
    const challenge = LearningEngine.generateSpeakingChallenge();
    if (!challenge) return;

    addBotMessage(
      `🗣 Say this in ${LanguageData.LANG_NAMES[LearningEngine.getState().targetLang]}:\n\n` +
      `**${challenge.nativeHint}**\n\n` +
      `(The answer is: "${challenge.targetPhrase}" — try saying it!)`
    );

    Speech.speak(challenge.targetPhrase, LearningEngine.getState().targetLang, 0.8);
  }

  // === MICROPHONE ===
  micBtn.addEventListener('mousedown', startRecording);
  micBtn.addEventListener('mouseup', stopRecording);
  micBtn.addEventListener('mouseleave', stopRecording);
  micBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
  micBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

  function startRecording() {
    if (!Speech.isRecognitionSupported()) {
      addBotMessage('Speech recognition is not supported in your browser. Try Chrome or Edge.');
      return;
    }

    micBtn.classList.add('recording');

    const st = LearningEngine.getState();
    // Listen in target language for speak mode, native for others
    const listenLang = st.mode === 'speak' ? st.targetLang : st.targetLang;

    Speech.startListening(listenLang, {
      onResult: (transcript, isFinal) => {
        msgInput.value = transcript;
        if (isFinal) {
          micBtn.classList.remove('recording');

          if (st.mode === 'speak' && st.currentQuiz && st.currentQuiz.isSpeaking) {
            // Check pronunciation
            addUserMessage(transcript);
            const result = LearningEngine.checkSpokenInput(transcript);
            if (result.correct) {
              addBotMessage(`Great pronunciation! "${result.targetPhrase}" ✓`);
              LearningEngine.recordCorrect(result.targetPhrase);
              setTimeout(startSpeakMode, 1500);
            } else {
              addBotMessage(`I heard "${result.heard}". The correct phrase is: **${result.expected}**. Try again!`);
              Speech.speak(result.expected, st.targetLang, 0.7);
            }
            updateStats();
          } else {
            sendMessage();
          }
        }
      },
      onError: (error) => {
        micBtn.classList.remove('recording');
        if (error !== 'no-speech') {
          addBotMessage(`Mic error: ${error}. Make sure you've allowed microphone access.`);
        }
      },
      onEnd: () => {
        micBtn.classList.remove('recording');
      }
    });
  }

  function stopRecording() {
    Speech.stopListening();
    micBtn.classList.remove('recording');
  }
})();
