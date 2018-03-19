function getSpecifictions(req_fields){

  let specifications = {};
  for (let key of Object.keys(req_fields)){
    specifications[key] = req_fields[key];
  }
  return specifications
}


module.exports = {
	getSpecifictions: getSpecifictions
};
