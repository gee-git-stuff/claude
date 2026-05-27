/**
 * Language data for LinguaChat.
 * Contains vocabulary, phrases, and grammar organized by difficulty level.
 */
const LanguageData = (() => {
  const LANG_NAMES = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German',
    ja: 'Japanese', pt: 'Portuguese', it: 'Italian'
  };

  // Speech synthesis language codes
  const SPEECH_CODES = {
    en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE',
    ja: 'ja-JP', pt: 'pt-BR', it: 'it-IT'
  };

  // Vocabulary organized by category and difficulty
  // Each entry: [en, es, fr, de, ja, pt, it]
  const VOCAB = {
    greetings: {
      beginner: [
        { en: 'hello', es: 'hola', fr: 'bonjour', de: 'hallo', ja: 'こんにちは', pt: 'olá', it: 'ciao' },
        { en: 'goodbye', es: 'adiós', fr: 'au revoir', de: 'auf Wiedersehen', ja: 'さようなら', pt: 'adeus', it: 'arrivederci' },
        { en: 'good morning', es: 'buenos días', fr: 'bonjour', de: 'guten Morgen', ja: 'おはようございます', pt: 'bom dia', it: 'buongiorno' },
        { en: 'good night', es: 'buenas noches', fr: 'bonne nuit', de: 'gute Nacht', ja: 'おやすみなさい', pt: 'boa noite', it: 'buonanotte' },
        { en: 'please', es: 'por favor', fr: 's\'il vous plaît', de: 'bitte', ja: 'お願いします', pt: 'por favor', it: 'per favore' },
        { en: 'thank you', es: 'gracias', fr: 'merci', de: 'danke', ja: 'ありがとう', pt: 'obrigado', it: 'grazie' },
        { en: 'yes', es: 'sí', fr: 'oui', de: 'ja', ja: 'はい', pt: 'sim', it: 'sì' },
        { en: 'no', es: 'no', fr: 'non', de: 'nein', ja: 'いいえ', pt: 'não', it: 'no' },
      ],
      intermediate: [
        { en: 'nice to meet you', es: 'mucho gusto', fr: 'enchanté', de: 'freut mich', ja: 'はじめまして', pt: 'prazer em conhecê-lo', it: 'piacere di conoscerti' },
        { en: 'how are you?', es: '¿cómo estás?', fr: 'comment allez-vous?', de: 'wie geht es Ihnen?', ja: 'お元気ですか？', pt: 'como você está?', it: 'come stai?' },
        { en: 'see you later', es: 'hasta luego', fr: 'à bientôt', de: 'bis später', ja: 'また後で', pt: 'até logo', it: 'a dopo' },
        { en: 'excuse me', es: 'disculpe', fr: 'excusez-moi', de: 'entschuldigung', ja: 'すみません', pt: 'com licença', it: 'mi scusi' },
      ],
      advanced: [
        { en: 'it\'s a pleasure', es: 'es un placer', fr: 'c\'est un plaisir', de: 'es ist mir eine Freude', ja: '光栄です', pt: 'é um prazer', it: 'è un piacere' },
        { en: 'long time no see', es: 'cuánto tiempo sin verte', fr: 'ça fait longtemps', de: 'lange nicht gesehen', ja: 'お久しぶりです', pt: 'há quanto tempo', it: 'da quanto tempo' },
      ]
    },
    food: {
      beginner: [
        { en: 'water', es: 'agua', fr: 'eau', de: 'Wasser', ja: '水', pt: 'água', it: 'acqua' },
        { en: 'bread', es: 'pan', fr: 'pain', de: 'Brot', ja: 'パン', pt: 'pão', it: 'pane' },
        { en: 'milk', es: 'leche', fr: 'lait', de: 'Milch', ja: '牛乳', pt: 'leite', it: 'latte' },
        { en: 'fruit', es: 'fruta', fr: 'fruit', de: 'Obst', ja: '果物', pt: 'fruta', it: 'frutta' },
        { en: 'meat', es: 'carne', fr: 'viande', de: 'Fleisch', ja: '肉', pt: 'carne', it: 'carne' },
        { en: 'rice', es: 'arroz', fr: 'riz', de: 'Reis', ja: 'ご飯', pt: 'arroz', it: 'riso' },
      ],
      intermediate: [
        { en: 'I am hungry', es: 'tengo hambre', fr: 'j\'ai faim', de: 'ich habe Hunger', ja: 'お腹が空きました', pt: 'estou com fome', it: 'ho fame' },
        { en: 'the bill please', es: 'la cuenta por favor', fr: 'l\'addition s\'il vous plaît', de: 'die Rechnung bitte', ja: 'お会計お願いします', pt: 'a conta por favor', it: 'il conto per favore' },
        { en: 'delicious', es: 'delicioso', fr: 'délicieux', de: 'lecker', ja: '美味しい', pt: 'delicioso', it: 'delizioso' },
        { en: 'breakfast', es: 'desayuno', fr: 'petit-déjeuner', de: 'Frühstück', ja: '朝ごはん', pt: 'café da manhã', it: 'colazione' },
      ],
      advanced: [
        { en: 'I would like to order', es: 'me gustaría pedir', fr: 'je voudrais commander', de: 'ich möchte bestellen', ja: '注文したいのですが', pt: 'eu gostaria de pedir', it: 'vorrei ordinare' },
        { en: 'I am allergic to', es: 'soy alérgico a', fr: 'je suis allergique à', de: 'ich bin allergisch gegen', ja: 'アレルギーがあります', pt: 'sou alérgico a', it: 'sono allergico a' },
      ]
    },
    travel: {
      beginner: [
        { en: 'where?', es: '¿dónde?', fr: 'où?', de: 'wo?', ja: 'どこ？', pt: 'onde?', it: 'dove?' },
        { en: 'left', es: 'izquierda', fr: 'gauche', de: 'links', ja: '左', pt: 'esquerda', it: 'sinistra' },
        { en: 'right', es: 'derecha', fr: 'droite', de: 'rechts', ja: '右', pt: 'direita', it: 'destra' },
        { en: 'hotel', es: 'hotel', fr: 'hôtel', de: 'Hotel', ja: 'ホテル', pt: 'hotel', it: 'hotel' },
        { en: 'airport', es: 'aeropuerto', fr: 'aéroport', de: 'Flughafen', ja: '空港', pt: 'aeroporto', it: 'aeroporto' },
        { en: 'train', es: 'tren', fr: 'train', de: 'Zug', ja: '電車', pt: 'trem', it: 'treno' },
      ],
      intermediate: [
        { en: 'where is the station?', es: '¿dónde está la estación?', fr: 'où est la gare?', de: 'wo ist der Bahnhof?', ja: '駅はどこですか？', pt: 'onde é a estação?', it: 'dov\'è la stazione?' },
        { en: 'how much does it cost?', es: '¿cuánto cuesta?', fr: 'combien ça coûte?', de: 'wie viel kostet es?', ja: 'いくらですか？', pt: 'quanto custa?', it: 'quanto costa?' },
        { en: 'I need help', es: 'necesito ayuda', fr: 'j\'ai besoin d\'aide', de: 'ich brauche Hilfe', ja: '助けが必要です', pt: 'preciso de ajuda', it: 'ho bisogno di aiuto' },
        { en: 'I am lost', es: 'estoy perdido', fr: 'je suis perdu', de: 'ich bin verloren', ja: '迷子になりました', pt: 'estou perdido', it: 'mi sono perso' },
      ],
      advanced: [
        { en: 'could you recommend a restaurant?', es: '¿podría recomendar un restaurante?', fr: 'pourriez-vous recommander un restaurant?', de: 'könnten Sie ein Restaurant empfehlen?', ja: 'レストランを勧めていただけますか？', pt: 'poderia recomendar um restaurante?', it: 'potrebbe consigliare un ristorante?' },
        { en: 'I have a reservation', es: 'tengo una reservación', fr: 'j\'ai une réservation', de: 'ich habe eine Reservierung', ja: '予約があります', pt: 'tenho uma reserva', it: 'ho una prenotazione' },
      ]
    },
    numbers: {
      beginner: [
        { en: 'one', es: 'uno', fr: 'un', de: 'eins', ja: '一', pt: 'um', it: 'uno' },
        { en: 'two', es: 'dos', fr: 'deux', de: 'zwei', ja: '二', pt: 'dois', it: 'due' },
        { en: 'three', es: 'tres', fr: 'trois', de: 'drei', ja: '三', pt: 'três', it: 'tre' },
        { en: 'four', es: 'cuatro', fr: 'quatre', de: 'vier', ja: '四', pt: 'quatro', it: 'quattro' },
        { en: 'five', es: 'cinco', fr: 'cinq', de: 'fünf', ja: '五', pt: 'cinco', it: 'cinque' },
        { en: 'ten', es: 'diez', fr: 'dix', de: 'zehn', ja: '十', pt: 'dez', it: 'dieci' },
      ],
      intermediate: [
        { en: 'twenty', es: 'veinte', fr: 'vingt', de: 'zwanzig', ja: '二十', pt: 'vinte', it: 'venti' },
        { en: 'fifty', es: 'cincuenta', fr: 'cinquante', de: 'fünfzig', ja: '五十', pt: 'cinquenta', it: 'cinquanta' },
        { en: 'hundred', es: 'cien', fr: 'cent', de: 'hundert', ja: '百', pt: 'cem', it: 'cento' },
      ],
      advanced: [
        { en: 'thousand', es: 'mil', fr: 'mille', de: 'tausend', ja: '千', pt: 'mil', it: 'mille' },
        { en: 'first', es: 'primero', fr: 'premier', de: 'erste', ja: '最初', pt: 'primeiro', it: 'primo' },
      ]
    },
    daily: {
      beginner: [
        { en: 'house', es: 'casa', fr: 'maison', de: 'Haus', ja: '家', pt: 'casa', it: 'casa' },
        { en: 'book', es: 'libro', fr: 'livre', de: 'Buch', ja: '本', pt: 'livro', it: 'libro' },
        { en: 'friend', es: 'amigo', fr: 'ami', de: 'Freund', ja: '友達', pt: 'amigo', it: 'amico' },
        { en: 'family', es: 'familia', fr: 'famille', de: 'Familie', ja: '家族', pt: 'família', it: 'famiglia' },
        { en: 'work', es: 'trabajo', fr: 'travail', de: 'Arbeit', ja: '仕事', pt: 'trabalho', it: 'lavoro' },
        { en: 'school', es: 'escuela', fr: 'école', de: 'Schule', ja: '学校', pt: 'escola', it: 'scuola' },
        { en: 'today', es: 'hoy', fr: "aujourd'hui", de: 'heute', ja: '今日', pt: 'hoje', it: 'oggi' },
        { en: 'tomorrow', es: 'mañana', fr: 'demain', de: 'morgen', ja: '明日', pt: 'amanhã', it: 'domani' },
      ],
      intermediate: [
        { en: 'I like', es: 'me gusta', fr: 'j\'aime', de: 'ich mag', ja: '好きです', pt: 'eu gosto', it: 'mi piace' },
        { en: 'I think that', es: 'creo que', fr: 'je pense que', de: 'ich denke dass', ja: 'と思います', pt: 'eu acho que', it: 'penso che' },
        { en: 'I want to', es: 'quiero', fr: 'je veux', de: 'ich will', ja: 'したいです', pt: 'eu quero', it: 'voglio' },
        { en: 'can you?', es: '¿puedes?', fr: 'pouvez-vous?', de: 'können Sie?', ja: 'できますか？', pt: 'você pode?', it: 'puoi?' },
      ],
      advanced: [
        { en: 'I would have liked to', es: 'me habría gustado', fr: 'j\'aurais aimé', de: 'ich hätte gern', ja: 'したかったです', pt: 'eu teria gostado de', it: 'mi sarebbe piaciuto' },
        { en: 'in my opinion', es: 'en mi opinión', fr: 'à mon avis', de: 'meiner Meinung nach', ja: '私の意見では', pt: 'na minha opinião', it: 'secondo me' },
        { en: 'on the other hand', es: 'por otro lado', fr: 'd\'autre part', de: 'andererseits', ja: '一方で', pt: 'por outro lado', it: "d'altra parte" },
      ]
    }
  };

  // Conversation templates for chatbot responses
  const CONVERSATION_TEMPLATES = {
    beginner: [
      { type: 'translate', prompt: 'How do you say "{word}" in {lang}?' },
      { type: 'fill', prompt: 'Complete: {partial}___' },
      { type: 'greet', prompt: 'Greet me in {lang}!' },
      { type: 'vocab', prompt: 'What does "{word}" mean?' },
    ],
    intermediate: [
      { type: 'sentence', prompt: 'Make a sentence using "{word}".' },
      { type: 'scenario', prompt: 'You are at a {place}. How would you {action}?' },
      { type: 'correct', prompt: 'Is this correct? "{sentence}"' },
      { type: 'translate', prompt: 'Translate: "{sentence}"' },
    ],
    advanced: [
      { type: 'essay', prompt: 'Describe {topic} in {lang}.' },
      { type: 'debate', prompt: 'What do you think about {topic}? Respond in {lang}.' },
      { type: 'idiom', prompt: 'What does the expression "{idiom}" mean?' },
      { type: 'story', prompt: 'Continue this story in {lang}: "{start}"' },
    ]
  };

  function getAllVocab(difficulty) {
    const items = [];
    for (const category of Object.values(VOCAB)) {
      if (category[difficulty]) {
        items.push(...category[difficulty]);
      }
      // Include easier levels too
      if (difficulty === 'intermediate' && category.beginner) {
        items.push(...category.beginner);
      }
      if (difficulty === 'advanced') {
        if (category.beginner) items.push(...category.beginner);
        if (category.intermediate) items.push(...category.intermediate);
      }
    }
    return items;
  }

  function getVocabForLevel(difficulty) {
    const items = [];
    for (const category of Object.values(VOCAB)) {
      if (category[difficulty]) {
        items.push(...category[difficulty]);
      }
    }
    return items;
  }

  function translate(text, fromLang, toLang) {
    const normalized = text.toLowerCase().trim();
    const allItems = getAllVocab('advanced'); // search everything
    for (const item of allItems) {
      if (item[fromLang] && item[fromLang].toLowerCase() === normalized) {
        return item[toLang] || null;
      }
    }
    return null;
  }

  function getRandomVocab(difficulty, lang) {
    const items = getVocabForLevel(difficulty);
    if (items.length === 0) return null;
    const item = items[Math.floor(Math.random() * items.length)];
    return item;
  }

  function getCategories() {
    return Object.keys(VOCAB);
  }

  return {
    LANG_NAMES,
    SPEECH_CODES,
    VOCAB,
    CONVERSATION_TEMPLATES,
    getAllVocab,
    getVocabForLevel,
    translate,
    getRandomVocab,
    getCategories
  };
})();
