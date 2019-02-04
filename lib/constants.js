
const CRED_SOURCES = {'ME': 'me', 'TRUSTED': 'trusted', 'USERNAMES': 'usernames'};
const VALIDITY_TYPES = {'CONFIRMED': 'confirmed', 'REFUTED': 'refuted', 'DEBATED': 'debated'};
const VALIDITY_CODES = {'CONFIRMED': 2, 'REFUTED': 0, 'DEBATED': 1};
const FEED_UPDATE_INT = 30 * 60 * 1000; //in ms

module.exports = {
  CRED_SOURCES,
  VALIDITY_TYPES,
  VALIDITY_CODES,
  FEED_UPDATE_INT
}
