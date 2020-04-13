
const CRED_SOURCES = { ME: 'me', TRUSTED: 'trusted', FOLLOWED: 'followed',
 SPECIFIED: 'specified', ANYONE: 'anyone' };
const VALIDITY_TYPES = { CONFIRMED: 'confirmed', REFUTED: 'refuted',
  DEBATED: 'debated', QUESTIONED: 'questioned' };
const SEEN_STATUS = { 'SEEN': 'seen', 'NOTSEEN': 'not seen' };
const VALIDITY_CODES = { 'CONFIRMED': 1, 'REFUTED': -1, 'QUESTIONED': 0 };

const ASSESSMENT_DECAY_FACTOR = 0.7;
const ASSESSMENT_UPDATE_THRESHOLD = 0.05;
const ASSESSMENT_ZERO_THRESHOLD = 0.1;

const TOKEN_TYPES = {'VERIFICATION': 1, 'RECOVERY': 2}
const TOKEN_EXP = {'VERIFICATION': 6 * 3600 * 1000, 'RECOVERY': 4 * 3600 * 1000}; //in ms
//const CLIENT_BASE_URL='http://localhost:8080';
const CLIENT_BASE_URL='http://trustnet.csail.mit.edu';

module.exports = {
  CRED_SOURCES,
  VALIDITY_TYPES,
  SEEN_STATUS,
  VALIDITY_CODES,
  ASSESSMENT_DECAY_FACTOR,
  ASSESSMENT_UPDATE_THRESHOLD,
  ASSESSMENT_ZERO_THRESHOLD,
  TOKEN_TYPES,
  TOKEN_EXP,
  CLIENT_BASE_URL
}
