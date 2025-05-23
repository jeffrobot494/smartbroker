const express = require('express');
const request = require('sync-request');
const app = express();
const port = 3000;


function Output(success = false, message = null, data = null) {
	this.success = success;
	this.message = message;
	this.data = null;
}


function CheckUserPhone(phone) {
	var key = 'CDonOIX0Ufai8yhlk7QXAWHGpNogttKN';
	var url = "https://www.ipqualityscore.com/api/json/phone/" + key + "/" + phone;
	var result = get_IPQ_URL(url);
	if (result !== null) {
		return result;
	}
	else {
		// Throw error, no response received.
	}
}


function get_IPQ_URL(url) {
	try {
		var response = request('GET', url);
		return JSON.parse(response.getBody());
	}
	catch (error) {
		return null;
	}
}

function ValidPhone(phone) {
	var phone_result = CheckUserPhone(phone);
	
	if (phone_result !== null) {
		if (typeof phone_result !== 'undefined' && phone_result['valid'] === true) {
			return true;
		}
	}
		
	return false;
}

app.get('/', (req, res) => {
	var phone = req.phone;
	console.log(phone);
	if (ValidPhone(phone) === false) {
		return res.send(new Output(true, 'Invalid or nonexistent phone number.'));
	}
	else {
		return res.send(new Output(true, 'Valid phone number.'));
	}
});


app.listen(port, () => {
	console.log(`Example app listening on port ${port}!`)
});