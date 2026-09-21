/**
 * scoring.js
 * All scoring rules live here so they are easy to change later.
 * To change the game's point values, just edit DEFAULT_SCORING below
 * or pass a custom `scoring` object in the room config.
 */

const DEFAULT_SCORING = {
  unique: 10,   // points for an answer nobody else gave (and is valid)
  duplicate: 5, // points for a valid answer that at least one other player also gave
  invalid: 0    // points for empty / wrong-letter / missing answers
};

const DEFAULT_CATEGORIES = ['Name', 'Country', 'City', 'Object', 'Animal', 'Surname'];

/** A valid answer must exist and start with the round's letter (case-insensitive). */
function isValidAnswer(answer, letter) {
  if (!answer || typeof answer !== 'string') return false;
  const trimmed = answer.trim();
  if (trimmed.length === 0) return false;
  return trimmed[0].toLowerCase() === letter.toLowerCase();
}

/**
 * playersAnswers: { [playerId]: { [category]: string } }
 * Returns: { [playerId]: { [category]: { answer, valid, points } }, totals: { [playerId]: number } }
 */
function calculateRoundScores(playersAnswers, alphabet, categories = DEFAULT_CATEGORIES, scoring = DEFAULT_SCORING) {
  const results = {};
  const totals = {};
  const playerIds = Object.keys(playersAnswers);
  playerIds.forEach((pid) => {
    results[pid] = {};
    totals[pid] = 0;
  });

  categories.forEach((category) => {
    // Count how many players gave each valid, normalized answer for this category
    const countByNormalized = {};
    playerIds.forEach((pid) => {
      const raw = (playersAnswers[pid] && playersAnswers[pid][category]) || '';
      if (isValidAnswer(raw, alphabet)) {
        const norm = raw.trim().toLowerCase();
        countByNormalized[norm] = (countByNormalized[norm] || 0) + 1;
      }
    });

    playerIds.forEach((pid) => {
      const raw = (playersAnswers[pid] && playersAnswers[pid][category]) || '';
      const valid = isValidAnswer(raw, alphabet);
      let points = scoring.invalid;
      if (valid) {
        const norm = raw.trim().toLowerCase();
        points = countByNormalized[norm] > 1 ? scoring.duplicate : scoring.unique;
      }
      results[pid][category] = { answer: raw.trim(), valid, points };
      totals[pid] += points;
    });
  });

  return { results, totals };
}

module.exports = { DEFAULT_SCORING, DEFAULT_CATEGORIES, isValidAnswer, calculateRoundScores };
