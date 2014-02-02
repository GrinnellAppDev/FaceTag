// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
Parse.Cloud.define("hello", function(request, response) {
	response.success("Hello world!");
}); // hello function


// createPairings creates the pairings for a game.
function createPairings(game) {
	var participants = game.get("participants"); //Array of user ids of participants. 

	//Clone array. http://davidwalsh.name/javascript-clone-array
	/*
	var participantsCopy = participants.slice(0);
	*/
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
} // createPairings()

//Before we save the Game Object. We do some initial setting up. 

Parse.Cloud.beforeSave("Game", function(request, response) {
	console.log("BEFORE SAVE GAME CALLED!");
	var game = request.object;

	if (game.isNew()) {

		game.set("round", 1);

		createPairings(game);

		console.log("The pairings changed..");
		game.set("pairings", pairings);
		console.log("Saving game object");
	} // if(new games)
	response.success();
});


//Before we save the PhotoTag Object. We do some checking! 
Parse.Cloud.beforeSave("PhotoTag", function(request, response) {

	var phototag = request.object;
	var confirmations = request.object.get("confirmation");
	var rejections = request.object.get("rejection");
	var threshold = request.object.get("threshold");
	var sender = request.object.get("sender"); //Parse.User() Object.. 
	var gameID = request.object.get("game"); //This is a game String ID. 

	console.log("Game object in PhotoTag: " + gameID);
	console.log("confirmations: " + confirmations);
	console.log("threshold: " + threshold);

	var Game = Parse.Object.extend("Game");
	var PhotoTag = Parse.Object.extend("PhotoTag");
	var query = new Parse.Query(Game);

	if (confirmations >= threshold) {
		//Win Condition. 
		console.log("Win condition met!");
		//Todo - Handle timings of tags. 

		//Update scores.  

		//Get game. 
		query.get(gameID, {
			success: function(game) {
				console.log("success");
				if (phototag.get("round") != game.get("round")) {
					phototag.destroy();
					response.success();
				}

				game.increment("round", 1);
				var scoreboard = game.get("scoreboard");
				console.log("Scoreboard before: " + scoreboard);
				console.log("SENDER: " + sender);
				console.log("Sender id " + sender.id);
				var score = ++scoreboard[sender.id];
				if (score == game.get("pointsToWin")) {

					game.set("gameOver", true);
					game.set("winner", sender);

					var photoquery = new Parse.Query(PhotoTag);
					photoquery.equalTo("game", gameID);
					photoquery.find({
						success: function(results) {
							for (var i = 0; i < results.length; i++) {
								results[i].destroy();
							}
							response.success();
						},
						error: function(error) {
							response.success();
						}
					});
				}

				game.set("scoreboard", scoreboard);

				createPairings(game);

				game.set("pairings", pairings);
				console.log("resettings pairings");

				game.save(null, {
					success: function(game) {
						// Execute any logic that should take place after the object is saved.
						console.log('Game saved: ' + game.id);
						response.success();
					},
					error: function(game, error) {
						// Execute any logic that should take place if the save fails.
						// error is a Parse.Error with an error code and description.
						console.log('Game didnt save error: ' + error.description);
						response.success();
					}
				});
			},
			error: function(object, error) {
				// The object was not retrieved successfully.
				// error is a Parse.Error with an error code and description.
				console.log("Error. Game not retrieved: " + error.description);
				response.success();
			}
		});

	} else if (rejections >= threshold) {
		phototag.destroy();
		response.success();
	} else {
		if (phototag.isNew()) {
			var thresh;
			query.get(gameID, {
				success: function(game) {
					var participants = game.get('participants');
					var count = participants.length;
					if (count < 20)
						thresh = count / 2;
					else thresh = 10;
					phototag.set("threshold", thresh);
					phototag.set("rejection", 0);
					phototag.set("confirmation", 0);
					var usersArray = [sender];
					phototag.set("usersArray", usersArray);
					phototag.set("round", game.get('round'));

					//For these new photo tags. Send out the push notifications as well. 
					//Send the push to these participants. 
					console.log("participants:" + participants);
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
							// Push was successful
							console.log("Push sent successfully");
							response.success();

						},
						error: function(error) {
							// Handle error
							console.log("Push failed..");
							response.success();

						}
					});
				},
				error: function(game, error) {
					console.log("error fetching game " + error.description);
					response.success();
				}
			});
		} else {
			response.success();
			console.log("Saving phototag: " + phototag);
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

	var gameID = request.object.get("game");  //This is a game String ID. 
	var senderFirstName = request.object.get("sender").get("firstName");  //Parse.User() Object.. 
	var targetFirstName = request.object.get("target").get("firstName");

	//var alert = senderFirstName + " just snapped " + targetFirstName;
	var alertString = "Someone just got facetagged!";

	var Game = Parse.Object.extend("Game");
	var query = new Parse.Query(Game);
	

	var phototag = request.object;

	if ( phototag.isNew() ) {
			console.log(alert); 
				query.get(gameID, {
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