// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
Parse.Cloud.define("hello", function(request, response) {
	response.success("Hello world!");
}); // hello function


// Cloud function for checking up on each game and timing rounds
Parse.Cloud.define("check_games", function(request, response) {
	var query = new Parse.Query("Game");
	query.find({
		success: function(results) {
			// results is an array of Parse.Object
			//	for each game in results
			results.forEach(function(game) {
				var endTime = game.get("endTime");
				var now = Math.round(+new Date() / 1000);
				if (now >= endTime) {
					// Select a winner
					var photoquery = new Parse.Query("PhotoTag");
					photoquery.equalTo("game", game.id);
					photoquery.find({
						success: function(photoTags) {
							var leader = -1;
							var leadVal = 0;
							for (var i = 0; i < photoTags.length; i++) {
								if (leadVal < photoTags[i].get("confirmation")) {
									leadVal = photoTags[i].get("confirmation");
									leader = i;
								}
							}
							if (0 > leader) {
								// If no winner
								incrementRound(game);
							} else {
								var winner = hotoTags[leader].get("sender");
								incrementRoundWithWinner(game, winner);
							}
						},
						error: function(error) {
							response.error("Error occured searching photoTags: " + error.description);
						}
					});
				}
			});
			response.success("Games updated");
		},
		error: function(error) {
			response.error("Error gettings games: " + error.description);
		}
	});
});

// Update game end time
function updateEndTime(game) {
	// Get current time in seconds
	var endTime = Math.round(+new Date() / 1000);
	// Add round time to it
	endTime += game.get("timePerTurn");
	game.set("endTime", endTime);
}

// Increments round, updates pairings/submitted/end time 
function incrementRound(game) {
	game.increment("round", 1);
	updateEndTime(game);
	createPairings(game);
	createSubmitted(game);
}

// Updates scoreboard, ends game if necessary
function incrementRoundWithWinner(game, winner) {
	var scoreboard = game.get("scoreboard");
	console.log("Scoreboard before: " + scoreboard);
	console.log("Round Winner: " + winner);
	console.log("Round Winner ID: " + winner.id);

	var score = ++scoreboard[winner.id];

	// If game is over, end it
	if (score == game.get("pointsToWin")) {
		game.set("gameOver", true);
		game.set("winner", winner);

		// Destroy PhotoTags associated with the game
		var photoquery = new Parse.Query("PhotoTag");
		photoquery.equalTo("game", game.id);
		photoquery.find({
			success: function(results) {
				for (var i = 0; i < results.length; i++) {
					results[i].destroy();
				}
				console.log("Game " + game.id + " ended, destroyed PhotoTags");
			},
			error: function(error) {
				response.error("Game " + game.id + " ended, Destroying old PhotoTags failed");
			}
		});
	} else {
		incrementRound(game);
		game.set("scoreboard", scoreboard);
	}
}

function createPairings(game) {
	var participants = game.get("participants"); //Array of user ids of participants.

	// Stop execution of pairings if there is only one participant
	if (1 == participants.length) {
		return;
	}

	var pairings = {};
	for (var i = 0; i < participants.length; i++) {
		var userId = participants[i];
		var target = userId;
		while (target == userId) {
			//Pick a random target. 
			var random = Math.floor((Math.random() * participants.length));
			target = participants[random];
		} // while
		//Add this pairing. 
		pairings[userId] = target;
	} // for
	game.set("pairings", pairings);
} // createPairings()

function createScoreboard(game) {
	var participants = game.get("participants"); //Array of user ids of participants. 
	var scoreboard = {};

	for (var i = 0; i < participants.length; i++) {
		var userId = participants[i];
		scoreboard[userId] = 0;
	} // for
	game.set("scoreboard", scoreboard);
} // createScoreboard()

function createSubmitted(game) {
	var participants = game.get("participants"); //Array of user ids of participants. 
	var submitted = {};

	for (var i = 0; i < participants.length; i++) {
		var userId = participants[i];
		submitted[userId] = false;
	} // for
	game.set("submitted", submitted);
} // createSubmitted()

function updatePairings(game) {
	var participants = game.get("participants"); //Array of user ids of participants.

	// Stop execution of pairings if there is only one participant
	if (1 == participants.length) {
		return;
	}
	var pairings = game.get("pairings");
	if (undefined === pairings)
		pairings = {};

	for (var i = 0; i < participants.length; i++) {
		var userId = participants[i];
		if (!(userId in pairings)) {
			var target = userId;
			while (target == userId) {
				//Pick a random target. 
				var random = Math.floor((Math.random() * participants.length));
				target = participants[random];
			} // while
			//Add this pairing. 
			pairings[userId] = target;
		}
	} // for
	game.set("pairings", pairings);
} // updatePairings()

function updateScoreboard(game) {
	var participants = game.get("participants"); //Array of user ids of participants. 
	var scoreboard = game.get("scoreboard");

	for (var i = 0; i < participants.length; i++) {
		var userId = participants[i];
		if (!(userId in scoreboard)) {
			scoreboard[userId] = 0;
		}
	} // for
	game.set("scoreboard", scoreboard);
} // updateScoreboard()

function updateSubmitted(game) {
	var participants = game.get("participants"); //Array of user ids of participants. 
	var submitted = game.get("submitted");

	for (var i = 0; i < participants.length; i++) {
		var userId = participants[i];
		if (!(userId in submitted)) {
			submitted[userId] = false;
		}
	} // for
	game.set("submitted", submitted);
} // updateSubmitted()

//Before we save the Game Object. We do some initial setting up. 
Parse.Cloud.beforeSave("Game", function(request, response) {
	var game = request.object;

	if (game.isNew()) {
		game.set("round", 1);
		updateEndTime(game);
		createPairings(game);
		createScoreboard(game);
		createSubmitted(game);
	} else { // Someone may have just joined the game
		updatePairings(game);
		updateScoreboard(game);
		updateSubmitted(game);
	}
	response.success();
});

//Before we save the User Object. We do some initial setting up. 
Parse.Cloud.beforeSave(Parse.User, function(request, response) {
	var user = request.object;

	if (user.isNew()) {
		user.set("wantsLaunchToCamera", true);
	} // if(new user)
	response.success();
});

//Before we save the PhotoTag Object. We do some checking! 
Parse.Cloud.beforeSave("PhotoTag", function(request, response) {

	var phototag = request.object;
	var confirmations = request.object.get("confirmation");
	var rejections = request.object.get("rejection");
	var threshold = request.object.get("threshold");
	var sender = request.object.get("sender"); //Parse.User() Object.. 
	var gameId = request.object.get("game"); //This is a game String ID. 

	var query = new Parse.Query("Game");
	if (confirmations >= threshold) {
		//Round win Condition. 
		console.log("Round win condition met!");
		//Todo - Handle timings of tags. 

		//Update scores.  

		//Get game. 
		query.get(gameId, {
			success: function(game) {
				console.log("success");
				if (phototag.get("round") != game.get("round")) {
					phototag.destroy();
					response.success("PhotoTag was for wrong round. Deleted it.");
				}

				incrementRoundWithWinner(game, sender);

				game.save(null, {
					success: function(game) {
						response.success('game ' + game.id + ' saved!');
					},
					error: function(game, error) {
						response.error('game ' + game.id + ' failed to save with error: ' + error.description);
					}
				});
			},
			error: function(object, error) {
				response.error("Error. Game not retrieved: " + error.description);
			}
		});
	} else if (rejections >= threshold) {
		phototag.destroy();
		response.success("PhotoTag was rejected too many times!");
	} else {
		if (phototag.isNew()) {
			var thresh;
			query.get(gameId, {
				success: function(game) {
					var submitted = game.get('submitted');
					if (submitted[sender.id]) {
						phototag.destroy();
						response.success();
					}

					submitted[sender.id] = true;
					game.set('submitted', submitted);
					game.save(null, {
						success: function(game) {
							console.log('game ' + game.id + ' saved!');
							var participants = game.get('participants');
							var count = participants.length;
							if (count < 20) {
								thresh = Math.floor(count / 2);
							} else {
								thresh = 10;
							}
							phototag.set("threshold", thresh);
							phototag.set("rejection", 0);
							phototag.set("confirmation", 0);
							var usersArray = [sender];
							phototag.set("usersArray", usersArray);
							phototag.set("round", game.get('round'));

							//For these new photo tags. Send out the push notifications as well. 
							//Send the push to these participants. 
							//console.log("participants:" + participants);
							var alertString = "Someone just got facetagged!";

							var userQuery = new Parse.Query(Parse.User);
							userQuery.containedIn("objectId", participants);

							var pushQuery = new Parse.Query(Parse.Installation);
							pushQuery.matchesQuery("owner", userQuery);

							Parse.Push.send({
								where: pushQuery, // Set our Installation query
								data: {
									alert: alertString
								}
							}, {
								success: function() {
									response.success("Push sent successfully");
								},
								error: function(error) {
									response.error("Push failed with error: " + error.description);
								}
							});
						},
						error: function(game, error) {
							response.error('game ' + game.id + ' failed to save with error: ' + error.description);
						}
					});
				},
				error: function(game, error) {
					response.error("error fetching game " + error.description);
				}
			});
		} else {
			response.success("Saving phototag: " + phototag);
		}
	}

	/*
  var comment = request.object.get("comment");
  if (comment.length > 140) {
    // Truncate and add a ...
    request.object.set("comment", comment.substring(0, 137) + "...");
  }
  */
});


/*
Parse.Cloud.afterSave("PhotoTag", function(request) {

	var gameId = request.object.get("game");  //This is a game String ID. 
	var senderFirstName = request.object.get("sender").get("firstName");  //Parse.User() Object.. 
	var targetFirstName = request.object.get("target").get("firstName");

	//var alert = senderFirstName + " just snapped " + targetFirstName;
	var alertString = "Someone just got facetagged!";

	var query = new Parse.Query("Game");
	

	var phototag = request.object;

	if ( phototag.isNew() ) {
			console.log(alert); 
				query.get(gameId, {
			success: function(game) {
				var participants = game.get('participants');
				//Send the push to these participants. 
				console.log("participants:" + participants); 

				var userQuery = new Parse.Query(Parse.User);
				userQuery.containedIn("objectId", participants); 

				var pushQuery = new Parse.Query(Parse.Installation);
				pushQuery.matchesQuery("owner", userQuery); 

				Parse.Push.send({
					where: pushQuery, // Set our Installation query
						data: {
							alert: alertString
						}
					}, {
						success: function() {
							// Push was successful
							console.log("Push sent successfully"); 
						},
						error: function(error) {
							// Handle error
							console.log("Push failed.."); 
						}
					});
				//response.success();
			}, error: function (game, error) {
				console.log("error  in sending push " + error.description);
				//response.success();
			}});
	} else {
		console.log("PhotoTag is not new"); 
	}
});
*/

//Clone array. http://davidwalsh.name/javascript-clone-array
/*
var participantsCopy = participants.slice(0);
*/
