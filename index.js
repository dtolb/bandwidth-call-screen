
/* Import our Modules */
const Bandwidth = require('node-bandwidth');
const express    = require('express');
const bodyParser = require('body-parser');
const path       = require('path');

/* Express Setup */
let app  = express();
let http = require('http').Server(app);
app.use(bodyParser.json());
app.set('port', (process.env.PORT || 3000));

/* Setup our Bandwidth information */
const forwardToNumber = process.env.FORWARD_TO_NUMBER;
const myCreds = {
  userId    : process.env.BANDWIDTH_USER_ID,
  apiToken  : process.env.BANDWIDTH_API_TOKEN,
  apiSecret : process.env.BANDWIDTH_API_SECRET
};
const bandwidthAPI = new Bandwidth(myCreds);


const handleAnswer = async (event) => {
  try {
    await bandwidthAPI.Call.speakSentence(event.callId, 'Please state your name then press any key');
  }
  catch (e) {
    console.log('Error trying to handle answer');
    console.log(e);
  }

};

const handleSpeak = async (event) => {
  if (event.status === 'started') {
    console.log(`Received ${event.eventType} ${event.status} for ${event.callId}`);
    return;
  }
  try {
    await bandwidthAPI.Call.enableRecording(event.callId);
    const gather = await bandwidthAPI.Call.createGather(event.callId, {
      maxDigits: '1',
      interDigitTimeout : '4'
    });
    console.log(`Created Gather: ${gather.id} on ${event.callId}`);
  }
  catch (e) {
    console.log('Error trying to handle speak');
    console.log(e);
  }
};

const handleGather = async (event) => {
  if (event.reason === 'hung-up') {
    console.log(`Caller on call ${event.callId} hung-up during the gather`);
  }
  try {
    await bandwidthAPI.Call.disableRecording(event.callId);
  }
  catch (e) {
    console.log('Error trying to handle gather');
    console.log(e);
  }
};

const handleRecording = async (event) => {
  if (event.status === 'error') {
    console.log(`Error handling the recording on ${event.callId}`);
  }
  try {
    const recordingInfo = await bandwidthAPI.Recording.get(event.recordingId);
    const callId = bandwidthAPI.Call.transfer(event.callId, {
      transferTo: forwardToNumber,
      whisperAudio: {
        fileUrl: recordingInfo.media
      }
    });
  }
  catch (e) {
    console.log('Error trying to handle Recording');
    console.log(e);
  }
};

/* Serve our lil website */
app.get('/', function (req, res) {
  res.send('Hello World 👋 🌎');
});

app.post('/incoming-call', (req, res) => {
  res.sendStatus(200); //go ahead and acknowledge the event from Bandwidth
  const event = req.body;
  console.log(`Received the ${event.eventType} event for ${event.callId}`);
  switch (event.eventType.toLowerCase()) {
    case 'answer':
      handleAnswer(event);
      break;
    case 'speak':
      handleSpeak(event);
      break;
    case 'gather':
      handleGather(event);
      break;
    case 'recording':
      handleRecording(event);
      break;
    default:
      break;
  }
});

http.listen(app.get('port'), function(){
    console.log('listening on *:' + app.get('port'));
});