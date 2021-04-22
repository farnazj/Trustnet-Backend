var request = require('request');

async function getPostURLIframeInfo(postUrl) {

    return new Promise((resolve, reject) => {
        request(postUrl, { method: 'HEAD' }, function (err, res, body) {
            let iframeIsAllowed = true;
            if ('x-frame-options' in res.headers || ('content-security-policy' in res.headers &&
                res.headers['content-security-policy'].indexOf("frame-ancestors 'self'") != -1) ) {
                iframeIsAllowed = false;

                if ('content-security-policy' in res.headers &&
                res.headers['content-security-policy'].indexOf("frame-ancestors 'self'") != -1)
                    console.log(res.headers['content-security-policy'], postUrl, '****\n')
            }
            resolve(iframeIsAllowed);
        });
    })

}

module.exports = {
    getPostURLIframeInfo
}