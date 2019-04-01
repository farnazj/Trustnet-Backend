var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const upload = require('../lib/uploadMiddleware');

router.route('/profile-pictures')

.post(routeHelpers.isLoggedIn, upload.single('avatar'), wrapAsync(async function(req, res) {

  if (!req.file) {
     return res.send({ success: false });
   }
  else {
    // let host = req.hostname;
    // let filePath = req.protocol + "://" + host + '/' + req.file.path;
    let filePath = req.file.path.replace('public/', '');
    let user = await db.Source.findById(req.user.id);

    if (user.photoUrl) {
      fs.unlink('public/' + user.photoUrl, (err) => {
        if (err) {
          console.error(err)
          return
        }
      });
    }

    await user.update({ photoUrl: filePath });
    return res.send({ success: true });
  }

}))


module.exports = router;
