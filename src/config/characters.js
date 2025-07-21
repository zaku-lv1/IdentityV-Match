// Identity V Character Data
// サバイバーキャラクター定義

const SURVIVOR_CHARACTERS = [
  { id: 'gardener', name: '庭師', nameEn: 'Gardener' },
  { id: 'lawyer', name: '弁護士', nameEn: 'Lawyer' },
  { id: 'doctor', name: '医師', nameEn: 'Doctor' },
  { id: 'thief', name: '泥棒', nameEn: 'Thief' },
  { id: 'explorer', name: '冒険家', nameEn: 'Explorer' },
  { id: 'forward', name: 'オフェンス', nameEn: 'Forward' },
  { id: 'cowboy', name: 'カウボーイ', nameEn: 'Cowboy' },
  { id: 'magician', name: 'マジシャン', nameEn: 'Magician' },
  { id: 'mechanic', name: '機械技師', nameEn: 'Mechanic' },
  { id: 'coordinator', name: '空軍', nameEn: 'Coordinator' },
  { id: 'lucky-guy', name: '幸運児', nameEn: 'Lucky Guy' },
  { id: 'priestess', name: '祭司', nameEn: 'Priestess' },
  { id: 'perfumer', name: '調香師', nameEn: 'Perfumer' },
  { id: 'seer', name: '心眼', nameEn: 'Seer' },
  { id: 'mercenary', name: '傭兵', nameEn: 'Mercenary' },
  { id: 'dancer', name: '踊り子', nameEn: 'Dancer' },
  { id: 'fortune-teller', name: '占い師', nameEn: 'Fortune Teller' },
  { id: 'embalmer', name: '納棺師', nameEn: 'Embalmer' },
  { id: 'prospector', name: '探鉱者', nameEn: 'Prospector' },
  { id: 'enchantress', name: '呪術師', nameEn: 'Enchantress' },
  { id: 'wildling', name: '野人', nameEn: 'Wildling' },
  { id: 'barmaid', name: 'バーメイド', nameEn: 'Barmaid' },
  { id: 'first-officer', name: '一等航海士', nameEn: 'First Officer' },
  { id: 'acrobat', name: '曲芸師', nameEn: 'Acrobat' },
  { id: 'postman', name: 'ポストマン', nameEn: 'Postman' },
  { id: 'gravekeeper', name: '墓守', nameEn: 'Gravekeeper' },
  { id: 'prisoner', name: '「囚人」', nameEn: 'Prisoner' },
  { id: 'entomologist', name: '昆虫学者', nameEn: 'Entomologist' },
  { id: 'painter', name: '画家', nameEn: 'Painter' },
  { id: 'batter', name: 'バッツマン', nameEn: 'Batter' },
  { id: 'toy-merchant', name: '玩具職人', nameEn: 'Toy Merchant' },
  { id: 'patient', name: '患者', nameEn: 'Patient' },
  { id: 'psychologist', name: '「心理学者」', nameEn: 'Psychologist' },
  { id: 'novelist', name: '小説家', nameEn: 'Novelist' },
  { id: 'little-girl', name: '「少女」', nameEn: 'Little Girl' },
  { id: 'weeping-clown', name: '泣きピエロ', nameEn: 'Weeping Clown' },
  { id: 'professor', name: '教授', nameEn: 'Professor' },
  { id: 'antiquarian', name: '骨董商', nameEn: 'Antiquarian' },
  { id: 'composer', name: '作曲家', nameEn: 'Composer' },
  { id: 'journalist', name: '記者', nameEn: 'Journalist' },
  { id: 'aeroplanist', name: '航空エンジニア', nameEn: 'Aeroplanist' },
  { id: 'cheerleader', name: '応援団', nameEn: 'Cheerleader' },
  { id: 'puppeteer', name: '人形師', nameEn: 'Puppeteer' },
  { id: 'fire-investigator', name: '火災調査員', nameEn: 'Fire Investigator' },
  { id: 'lady-faulkner', name: '「レディ・ファウロ」', nameEn: 'Lady Faulkner' },
  { id: 'knight', name: '「騎士」', nameEn: 'Knight' },
  { id: 'meteorologist', name: '気象学者', nameEn: 'Meteorologist' },
  { id: 'archer', name: '弓使い', nameEn: 'Archer' },
  { id: 'escape-master', name: '「脱出マスター」', nameEn: 'Escape Master' }
];

// ハンターキャラクター（将来の拡張用）
const HUNTER_CHARACTERS = [
  // 今後追加予定
];

/**
 * キャラクターIDから名前を取得
 * @param {string} characterId 
 * @returns {string}
 */
function getCharacterName(characterId) {
  const character = SURVIVOR_CHARACTERS.find(char => char.id === characterId);
  return character ? character.name : characterId;
}

/**
 * キャラクターIDから英語名を取得
 * @param {string} characterId 
 * @returns {string}
 */
function getCharacterNameEn(characterId) {
  const character = SURVIVOR_CHARACTERS.find(char => char.id === characterId);
  return character ? character.nameEn : characterId;
}

/**
 * サバイバーキャラクター一覧を取得
 * @returns {Array}
 */
function getSurvivorCharacters() {
  return SURVIVOR_CHARACTERS;
}

/**
 * ハンターキャラクター一覧を取得
 * @returns {Array}
 */
function getHunterCharacters() {
  return HUNTER_CHARACTERS;
}

module.exports = {
  SURVIVOR_CHARACTERS,
  HUNTER_CHARACTERS,
  getCharacterName,
  getCharacterNameEn,
  getSurvivorCharacters,
  getHunterCharacters
};