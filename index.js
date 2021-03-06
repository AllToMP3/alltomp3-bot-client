const WebSocketClient = require('websocket').client;
const storage = require('node-persist');
const alltomp3 = require('alltomp3');
const fs = require('fs');

const SERVER_URL = 'wss://server.alltomp3.org/telegram/';
const MAX_PARALLEL = 4;
const TEMP_FOLDER = '/tmp/';

let client = new WebSocketClient();
let con;
let waittry = 1;
let credentials;
let confirmk;

let processing = {
  active: 0,
  queue: [],
  newQuery: function (q) {
    this.queue.push(q);
    this.processNext();
  },
  processQuery: function (q) {
    console.log('Processing', q.id, q.trackURL || q.singleURL);
    this.active += 1;
    if (q.trackURL) {
      var e = alltomp3.downloadTrackURL(q.trackURL, TEMP_FOLDER);
    } else if (q.singleURL) {
      var e = alltomp3.downloadAndTagSingleURL(q.singleURL, TEMP_FOLDER);
    } else {
      return;
    }
    let progress = 0;
    e.on('download', (infos) => {
      if (infos.progress / 2 - progress > 25) {
        progress = infos.progress / 2;
        senda({ id: q.id, progress: progress });
      }
    });
    e.on('download-end', (infos) => {
      progress = 50;
      senda({ id: q.id, progress: progress });
    });
    e.on('convert', (infos) => {
      if (infos.progress / 2 + 50 - progress > 25) {
        progress = infos.progress / 2 + 50;
        senda({ id: q.id, progress: progress });
      }
    });
    e.once('end', (infos) => {
      const sendFile = (filepath) => {
        fs.readFile(filepath, (err, data) => {
          const bufId = Buffer.from(q.id);
          const len = bufId.length + data.length;
          const buf = Buffer.concat([bufId, data], len);
          console.log('End of', q.id, 'sending buffer of length', len);
          con.sendBytes(buf);
          this.active -= 1;
          this.processNext();
          fs.unlinkSync(filepath);
        });
      };

      const fileStats = fs.statSync(infos.file);
      if (fileStats.size >= 49 * 1000 * 1000 && q.singleURL) {
        fs.unlinkSync(infos.file);
        console.log('File too large: converting to 128 kb/s');
        // Telegram has a max size of 50 MB
        const newEvents = alltomp3.downloadAndTagSingleURL(q.singleURL, TEMP_FOLDER, null, null, null, null, {
          bitrate: '128k',
        });
        newEvents.once('end', (newInfos) => sendFile(newInfos.file));
      } else {
        sendFile(infos.file);
      }
    });
    e.on('error', (error) => {
      senda({ id: q.id, error: error });
      console.error('An error occured', error);
      this.active -= 1;
      this.processNext();
    });
  },
  processNext: function () {
    if (this.active < MAX_PARALLEL && this.queue.length > 0) {
      let q = this.queue.shift();
      this.processQuery(q);
    }
  },
};

client.on('connectFailed', function (error) {
  console.log('Connect Error: ' + error.toString());
});

let reconnectTimer;

client.on('connect', function (connection) {
  con = connection;
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }
  console.log('Connected!\n');
  connection.on('error', function (error) {
    console.log('Connection Error: ' + error.toString());
  });
  connection.on('close', function () {
    console.log('Connection closed, retrying in 30s...');
    reconnectTimer = setInterval(() => {
      client.connect(SERVER_URL, 'echo-protocol');
    }, 30000);
  });
  connection.on('message', function (message) {
    if (message.type === 'utf8') {
      try {
        var message = JSON.parse(message.utf8Data);
      } catch (e) {}
      if (message.key && message.password && message.confirm) {
        storage.setItem('credentials', {
          key: message.key,
          password: message.password,
        });
        storage.setItem('confirm', message.confirm);
        console.log(
          'Now registered.\nTo manage your bot from Telegram, talk to @AllToMP3_bot.\n\nYour key is: ' +
            message.key +
            '-' +
            message.confirm +
            '\n\n',
        );
      } else if (message.query) {
        processing.newQuery(message.query);
      }
    }
  });

  storage.getItem('credentials', function (err, cred) {
    if (!cred) {
      senda({ hello: 'world!' });
    } else {
      credentials = cred;
      storage.getItem('confirm', function (err, confirm) {
        if (confirm) {
          confirmk = confirm;
          console.log('Your key is: ' + credentials.key + '-' + confirm + '\n\n');
        }
      });
      senda(credentials);
    }
  });
});

storage
  .init({
    dir: './data/',
    stringify: JSON.stringify,
    parse: JSON.parse,
    encoding: 'utf8',
  })
  .then(function () {
    storage.getItem('credentials', function (err, cred) {
      credentials = cred;
      storage.getItem('confirm', function (err, confirm) {
        confirmk = confirm;
        client.connect(SERVER_URL, 'echo-protocol');
      });
    });
  });

let senda = (message) => {
  con.sendUTF(JSON.stringify(message));
};
