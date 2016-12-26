'use strict';

var http = require('http');

// Route the incoming request based on
// type (LaunchRequest, IntentRequest, etc.)
// The JSON body of the request is provided in the event param.
exports.handler = function(event, context) {
  try {
    console.log(
      'event.session.application.applicationId=' +
      event.session.application.applicationId
    );

    // make sure no one else uses this endpoint
    var appId = 'amzn1.ask.skill.' +
      'd270f180-66f3-4b5c-a02e-468bc9e4d569';
    if (event.session.application.applicationId !== appId) {
      context.fail('Invalid Application ID');
    }

    if (event.session.new) {
      onSessionStarted({
        requestId: event.request.requestId
      }, event.session);
    }

    if (event.request.type === 'LaunchRequest') {
      onLaunch(
        event.request,
        event.session,
        function callback(sessionAttributes, speechletResponse) {
          context.succeed(
            buildResponse(sessionAttributes, speechletResponse)
          );
        }
      );
    } else if (event.request.type === 'IntentRequest') {
      onIntent(
        event.request,
        event.session,
        function callback(sessionAttributes, speechletResponse) {
          context.succeed(
            buildResponse(sessionAttributes, speechletResponse)
          );
        }
      );
    } else if (event.request.type === 'SessionEndedRequest') {
      onSessionEnded(event.request, event.session);
      context.succeed();
    }
  } catch (e) {
    context.fail('Exception: ' + e);
  }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
  console.log(
    'onSessionStarted requestId=' +
    sessionStartedRequest.requestId +
    ', sessionId=' + session.sessionId
  );

  // add any session init logic here
}

/**
 * Called when the user invokes the skill without
 * specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
  console.log(
    'onLaunch requestId=' + launchRequest.requestId +
    ', sessionId=' + session.sessionId
  );
  getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
  console.log(
    'onIntent requestId=' + intentRequest.requestId +
    ', sessionId=' + session.sessionId
  );

  var intent = intentRequest.intent;
  var intentName = intentRequest.intent.name;

  // handle yes/no intent after the user has been prompted
  if (
    session.attributes &&
    session.attributes.userPromptedToContinue
  ) {
    delete session.attributes.userPromptedToContinue;
    if ('AMAZON.NoIntent' === intentName) {
      handleFinishSessionRequest(intent, session, callback);
    } else if ('AMAZON.YesIntent' === intentName) {
      handleRepeatRequest(intent, session, callback);
    }
  }

  // dispatch custom intents to handlers here
  if ('StockIntent' === intentName) {
    handleStockRequest(intent, session, callback);
  } else if ('StockOnlyIntent' === intentName) {
    handleStockRequest(intent, session, callback);
  } else if ('AMAZON.YesIntent' === intentName) {
    handleStockRequest(intent, session, callback);
  } else if ('AMAZON.NoIntent' === intentName) {
    handleStockRequest(intent, session, callback);
  } else if ('AMAZON.StartOverIntent' === intentName) {
    getWelcomeResponse(callback);
  } else if ('AMAZON.RepeatIntent' === intentName) {
    handleRepeatRequest(intent, session, callback);
  } else if ('AMAZON.HelpIntent' === intentName) {
    handleGetHelpRequest(intent, session, callback);
  } else if ('AMAZON.StopIntent' === intentName) {
    handleFinishSessionRequest(intent, session, callback);
  } else if ('AMAZON.CancelIntent' === intentName) {
    handleFinishSessionRequest(intent, session, callback);
  } else {
    throw 'Invalid intent';
  }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
  console.log(
    'onSessionEnded requestId=' +
    sessionEndedRequest.requestId + ', sessionId=' +
    session.sessionId
  );

  // Add any cleanup logic here
}

// ------- Skill specific business logic -------

var CARD_TITLE = 'Stock Market';

function getWelcomeResponse(callback) {
  var speechOutput = 'I can help you check the' +
    ' price of stocks. ';
  var shouldEndSession = false;

  var repromptText = 'What stock would you like the price of?';
  speechOutput += repromptText;
  var sessionAttributes = {
    'speechOutput': repromptText,
    'repromptText': repromptText
  };
  callback(
    sessionAttributes,
    buildSpeechletResponse(
      CARD_TITLE, speechOutput, repromptText, shouldEndSession
    )
  );
}

function handleStockRequest(intent, session, callback) {
  var speechOutput = '';
  var repromptText = '';
  var sessionAttributes = {};
  var stock = intent.slots.Stock.value
  var shouldEndSession = true;

  if (stock !== undefined && stock !== 'undefined') {
    var url = 'http://dev.markitondemand.com/MODApis/';
    url += 'Api/v2/Quote/json?symbol=' + stock;

    http.get(url, function(res) {
      var statusCode = res.statusCode;

      res.setEncoding('utf8');
      var rawData = '';
      res.on('data', function(chunk) { rawData += chunk; });

      res.on('end', function() {
        var body = JSON.parse(rawData);
        if (body.Status === 'SUCCESS' && statusCode === 200) {
          speechOutput = 'Currently, one share of ' +
            body.Name + ' is $' + body.LastPrice +'.';
          repromptText = speechOutput;
        } else {
          speechOutput = 'Sorry, I couldn\'t find the stock' + 
            ' with ticker ' + stock + '. ';
          repromptText = 'What stock would you like to know' +
            ' the price of?';
          speechOutput += repromptText;
          shouldEndSession = false;
        }
        callback(
          sessionAttributes,
          buildSpeechletResponse(
            CARD_TITLE, speechOutput,
            repromptText, shouldEndSession
          )
        );
      });
    }).on('error', function(e) {
      speechOutput = 'Sorry, I couldn\'t find the stock' + 
        ' with ticker ' + stock + '. ';
      repromptText = 'What stock would you like to know' +
        ' the price of?';
      speechOutput += repromptText;
      shouldEndSession = false;
      callback(
        sessionAttributes,
        buildSpeechletResponse(
          CARD_TITLE, speechOutput,
          repromptText, shouldEndSession
        )
      );
    });
  } else {
    speechOutput = 'What was that stock ticker again?';
    repromptText = speechOutput;
    shouldEndSession = false;
    callback(
      sessionAttributes,
      buildSpeechletResponse(
        CARD_TITLE, speechOutput, repromptText, shouldEndSession
      )
    );
  }
}

function handleRepeatRequest(intent, session, callback) {
  if (!session.attributes || !session.attributes.speechOutput) {
    getWelcomeResponse(callback);
  } else {
    callback(
      session.attributes,
      buildSpeechletResponseWithoutCard(
        session.attributes.speechOutput,
        session.attributes.repromptText,
        false
      )
    );
  }
}

function handleGetHelpRequest(intent, session, callback) {
  // Ensure that session.attributes has been initialized
  if (!session.attributes) {
    session.attributes = {};
  }

  // Set a flag to track that we're in the Help state.
  session.attributes.userPromptedToContinue = true;

  var speechOutput = 'I can help you check the' +
    ' price of stocks. ';
  var repromptText = 'What stock would you like the price of?';
  speechOutput += repromptText;
  callback(
    session.attributes,
    buildSpeechletResponseWithoutCard(
      speechOutput, repromptText, false
    )
  );
}

function handleFinishSessionRequest(intent, session, callback) {
  callback(
    session.attributes,
    buildSpeechletResponseWithoutCard(
      'You\'re welcome master. I\'ll miss you.', '', true
    )
  );
}

// ------- Helper functions to build responses -------


function buildSpeechletResponse(
  title, output, repromptText, shouldEndSession
) {
  return {
    outputSpeech: {
      type: 'PlainText',
      text: output
    },
    card: {
      type: 'Simple',
      title: title,
      content: output
    },
    reprompt: {
      outputSpeech: {
        type: 'PlainText',
        text: repromptText
      }
    },
    shouldEndSession: shouldEndSession
  };
}

function buildSpeechletResponseWithoutCard(
  output, repromptText, shouldEndSession
) {
  return {
    outputSpeech: {
      type: 'PlainText',
      text: output
    },
    reprompt: {
      outputSpeech: {
        type: 'PlainText',
        text: repromptText
      }
    },
    shouldEndSession: shouldEndSession
  };
}

function buildResponse(sessionAttributes, speechletResponse) {
  return {
    version: '1.0',
    sessionAttributes: sessionAttributes,
    response: speechletResponse
  };
}
