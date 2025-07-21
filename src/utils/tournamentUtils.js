/**
 * Tournament utility functions for deadline checking and status management
 */

/**
 * Check if a tournament's entry deadline has passed
 * @param {Object} tournament - Tournament object with entryDeadline field
 * @returns {boolean} - True if deadline has passed
 */
function isEntryDeadlinePassed(tournament) {
  if (!tournament.entryDeadline) {
    return false; // No deadline set means always open
  }
  
  const now = new Date();
  let deadline;
  
  // Handle Firestore timestamp format
  if (tournament.entryDeadline.seconds) {
    deadline = new Date(tournament.entryDeadline.seconds * 1000);
  } else {
    deadline = new Date(tournament.entryDeadline);
  }
  
  return now > deadline;
}

/**
 * Get the appropriate tournament status based on deadline and current status
 * @param {Object} tournament - Tournament object
 * @returns {string} - Updated status
 */
function getUpdatedTournamentStatus(tournament) {
  const currentStatus = tournament.status;
  
  // Don't change status if already finished or ongoing
  if (currentStatus === 'finished' || currentStatus === 'ongoing') {
    return currentStatus;
  }
  
  // If deadline passed and currently open, close it
  if (currentStatus === 'open' && isEntryDeadlinePassed(tournament)) {
    return 'closed';
  }
  
  return currentStatus;
}

/**
 * Check if entry operations (enter/cancel) are allowed for a tournament
 * @param {Object} tournament - Tournament object
 * @returns {Object} - { allowed: boolean, reason: string }
 */
function isEntryAllowed(tournament) {
  // Check if tournament status allows entries
  if (tournament.status !== 'open') {
    return {
      allowed: false,
      reason: tournament.status === 'closed' ? 'エントリー期限が締切られました' : 
              tournament.status === 'ongoing' ? '大会が開始されています' :
              tournament.status === 'finished' ? '大会が終了しています' :
              'エントリーを受け付けていません'
    };
  }
  
  // Check deadline
  if (isEntryDeadlinePassed(tournament)) {
    return {
      allowed: false,
      reason: 'エントリー期限が過ぎています'
    };
  }
  
  return { allowed: true, reason: null };
}

/**
 * Format date for display in Japanese locale
 * @param {Date|Object} date - Date object or Firestore timestamp
 * @returns {string} - Formatted date string
 */
function formatJapaneseDate(date) {
  if (!date) return '未設定';
  
  let d;
  if (date.seconds) {
    d = new Date(date.seconds * 1000);
  } else {
    d = new Date(date);
  }
  
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get time remaining until deadline
 * @param {Date|Object} deadline - Deadline date or Firestore timestamp
 * @returns {Object} - { expired: boolean, timeRemaining: string }
 */
function getTimeRemaining(deadline) {
  if (!deadline) {
    return { expired: false, timeRemaining: '期限なし' };
  }
  
  let deadlineDate;
  if (deadline.seconds) {
    deadlineDate = new Date(deadline.seconds * 1000);
  } else {
    deadlineDate = new Date(deadline);
  }
  
  const now = new Date();
  const diff = deadlineDate - now;
  
  if (diff <= 0) {
    return { expired: true, timeRemaining: '期限切れ' };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return { expired: false, timeRemaining: `あと${days}日${hours}時間` };
  } else if (hours > 0) {
    return { expired: false, timeRemaining: `あと${hours}時間${minutes}分` };
  } else {
    return { expired: false, timeRemaining: `あと${minutes}分` };
  }
}

/**
 * Validate if team formation is allowed based on participant count
 * @param {number} participantCount - Number of participants
 * @returns {Object} - { allowed: boolean, reason: string }
 */
function validateTeamFormation(participantCount) {
  if (participantCount < 4) {
    return {
      allowed: false,
      reason: 'チーム作成には最低4人の参加者が必要です'
    };
  }
  
  if (participantCount > 7) {
    return {
      allowed: false,
      reason: '編成は最大7人までです。8人未満でないとゲームが成立しません'
    };
  }
  
  return { allowed: true, reason: null };
}

module.exports = {
  isEntryDeadlinePassed,
  getUpdatedTournamentStatus,
  isEntryAllowed,
  formatJapaneseDate,
  getTimeRemaining,
  validateTeamFormation
};