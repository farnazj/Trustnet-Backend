
const CRED_SOURCES = {'ME': 'me', 'TRUSTED': 'trusted', 'USERNAMES': 'usernames'};
const VALIDITY_TYPES = {'CONFIRMED': 'confirmed', 'REFUTED': 'refuted',
  'DEBATED': 'debated', 'QUESTIONED': 'questioned'};
const SEEN_STATUS = {'SEEN': 'seen', 'NOTSEEN': 'not seen'};
const VALIDITY_CODES = {'CONFIRMED': 1, 'REFUTED': -1, 'QUESTIONED': 0};
//const FEED_UPDATE_INT = 10 * 60 * 1000; //in ms

module.exports = {
  CRED_SOURCES,
  VALIDITY_TYPES,
  SEEN_STATUS,
  VALIDITY_CODES
  //FEED_UPDATE_INT
}
