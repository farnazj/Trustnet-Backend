var multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, './public/profile_photos/')
  },
  filename: function (req, file, callback) {
    const newFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    callback(null, newFilename);
  }
});

var upload = multer({ storage: storage });

module.exports = upload;
