var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const upload = require('../lib/uploadMiddleware');

router.route('/pictures')

.post(routeHelpers.isLoggedIn, upload.single('avatar'), wrapAsync(async function(req, res) {

  if (!req.file) {
     return res.send({ success: false });
   }
  else {
    // let host = req.hostname;
    // let filePath = req.protocol + "://" + host + '/' + req.file.path;
    let user = await db.Source.findById(req.user.id);

    if (user.photoUrl) {
      fs.unlink(user.photoUrl, (err) => {
        if (err) {
          console.error(err)
          return
        }
      });
    }

    await user.update({ photoUrl: req.file.path });
    return res.send({ success: true });
  }

}))

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let user = await db.Source.findById(req.user.id);
  res.sendFile(user.photoUrl, { root: path.join(__dirname, '..') });
}));

module.exports = router;
