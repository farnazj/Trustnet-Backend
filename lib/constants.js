
const CRED_SOURCES = { ME: 'me', TRUSTED: 'trusted', FOLLOWED: 'followed',
 SPECIFIED: 'specified'};
const VALIDITY_TYPES = { CONFIRMED: 'confirmed', REFUTED: 'refuted',
  DEBATED: 'debated', QUESTIONED: 'questioned', ALL: 'all' };
const SEEN_STATUS = { 'SEEN': 'seen', 'NOTSEEN': 'not seen' };
const VALIDITY_CODES = { 'CONFIRMED': 1, 'REFUTED': -1, 'QUESTIONED': 0 };

const ASSESSMENT_DECAY_FACTOR = 0.7;
const ASSESSMENT_UPDATE_THRESHOLD = 0.05;
const ASSESSMENT_ZERO_THRESHOLD = 0.1;

const TOKEN_TYPES = {'ACCOUNT_VERIFICATION': 1, 'ACOUNT_RECOVERY': 2, 'OUTSIDE_SOURCE_ASSESSMENT': 3}
const TOKEN_EXP = {'ACCOUNT_VERIFICATION': 6 * 3600 * 1000, 'ACOUNT_RECOVERY': 4 * 3600 * 1000}; //in ms
//const CLIENT_BASE_URL='http://localhost:8080';
const CLIENT_BASE_URL='http://trustnet.csail.mit.edu';
const SITE_NAME = 'Trustnet'
const LENGTH_TO_HASH = 25;

const REASON_CODES_ENUM = Object.freeze({
  'accurate': {
    "I have a high degree of knowledge on this topic that allows me to assess this claim myself (e.g., I teach/write about this topic or I use this in my work)": 1,
    "I have firsthand knowledge of the subject or am an eyewitness.": 2,
    "My other trusted sources (besides the source of this article) confirm the entire claim.": 3,
    "The claim is from a source I trust.": 4,
    "Evidence presented in the article corroborates the claim.": 5,
    "The claim is consistent with my past experience and observations.": 6,
    "I’m not sure, but I want the claim to be true.": 7,
    "I was just guessing.": 8,
    "Other": 9
  },
  'inaccurate': {
    "I have a high degree of knowledge on this topic that allows me to assess this claim myself (e.g., I teach/write about this topic or I use this in my work)": 10,
    "I have firsthand knowledge of the subject or am an eyewitness.": 11,
    "The claim contradicts some information related to the case that I know from trusted sources.": 12,
    "The claim is not consistent with my past experience and observations": 13,
    "If this were true, I would have heard about it.": 14,
    "The claim appears to be inaccurate based on its presentation (its language, flawed logic, etc.)": 15,
    "The claim appears motivated or biased.": 16,
    "The claim references something that is impossible to prove.": 17,
    "I’m not sure, but I do not want the claim to be true.": 18,
    "I was just guessing.": 19,
    "Other": 20
  },
  'extra': {
    "The claim is misleading.": 21,
    "The claim is not from a source I trust.": 22
  }
})

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
  CLIENT_BASE_URL,
  SITE_NAME,
  LENGTH_TO_HASH, REASON_CODES_ENUM
}
