/*
https://medium.com/@chanakyabhardwaj/es6-reverse-iterable-for-an-array-5dae91c02904
*/
function reversedIterator(arr) {
  let index = arr.length;

  let rIterator = {
       next : function () {
           index--;
           return {
               done : index < 0,
               value : arr[index]
           }
       }
  }

  rIterator[Symbol.iterator] = function() {
     return this;
  }
  return rIterator;
}

module.exports = {
  reversedIterator
}
