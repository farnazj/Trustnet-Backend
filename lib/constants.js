
const CRED_SOURCES = {'ME': 'me', 'TRUSTED': 'trusted', 'USERNAMES': 'usernames'};
const VALIDITY_TYPES = {'CONFIRMED': 'confirmed', 'REFUTED': 'refuted',
  'DEBATED': 'debated', 'QUESTIONED': 'questioned'};
const SEEN_STATUS = {'SEEN': 'seen', 'NOTSEEN': 'not seen'};
const VALIDITY_CODES = {'CONFIRMED': 2, 'REFUTED': 0, 'QUESTIONED': 1};
//const FEED_UPDATE_INT = 10 * 60 * 1000; //in ms
const VERIFICATION_TOKEN_EXP = 2; //in hrs
const PASSWORD_TOKEN_EXP = 3600 * 1000; //in ms

module.exports = {
  CRED_SOURCES,
  VALIDITY_TYPES,
  SEEN_STATUS,
  VALIDITY_CODES,
  VERIFICATION_TOKEN_EXP,
  PASSWORD_TOKEN_EXP
  //FEED_UPDATE_INT
}
