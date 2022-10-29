'use strict'

function sanitizeTags(tagsArray, split) {
  let genericWords = ['article', 'story'];
  let discards = ['- cnn']

  const regex = /,\s[a-zA-Z]+/g;

  let flattenedArr = [].concat.apply([], tagsArray.map(el => {
    if (split || el.match(regex) !== null)
      return el.split(',')
    else
      return el;
    })
  );

  return flattenedArr.map(el => el.trim()).filter(el =>
    el.length &&
    !genericWords.includes(el.toLowerCase()) &&
    discards.every(discard => !el.toLowerCase().includes(discard)));
}

module.exports = () => {
  const rules = {
    tags: [
       ({ htmlDom: $, url }) => {
         let tagsArray = $('meta[property="article:tag"]').map(
           (i, el) => $(el).attr('content')).toArray();

         return sanitizeTags(tagsArray, false);
       },
       ({ htmlDom: $, url }) => {
         let tagsArray = $('meta[name="keywords"]').map(
           (i, el) => $(el).attr('content')).toArray();

         return sanitizeTags(tagsArray, true);
       },
       ({ htmlDom: $, url }) => {
         let tagsArray = $('.tag-links .tag').map((i, el) => {
          $(el).find('.count').remove();
          return $(el).text()
        }).get();

         return sanitizeTags(tagsArray, false);
       }

    ],
    opinion: [
      ({ htmlDom: $, url }) => $('meta[property="article:opinion"]').attr('content')
    ]
  }
  return rules;
}
