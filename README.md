# AllToMP3 - Telegram bot

It's possible to use AllToMP3 as a bot from Telegram, to download music in chats.
You will have to launch a daemon on a Linux server, which will download and convert songs before uploading them to Telegram.
This repository is this daemon.

## Requirements

* Node ≥ 6.10;
* ffmpeg >= 2.8 with lamemp3;
* `libchromaprint-tools`;
* eyeD3 >= 0.7.10 (it's very important to have a recent version!).

## Installation

Clone the repository, and inside it:
```
mkdir data
npm install
```

## Configuration

In the file `index.js`, you can change the temporary folder where files will be downloaded.

## Use

To launch the daemon:
`node .`  
It will automatically register to the server, and displays a **key**.

Then, on Telegram, open a private chat with `@AllToMP3_bot`, and send a message `/register here-the-key-displayed-by-the-daemon`. It will link the daemon to your Telegram account.

Then, on a group conversation, you can invite `@AllToMP3_bot`, and download a song with `/dl the name of the song` or `/dl http://url-of-some-video`. It's your daemon on your server that will download and convert the songs.

## Disclaimer

**The bot is highly experimental.** First it lacks an easy installation (like a deb package), it crashes from time to time, doesn't work in a private chat, only in a group conversation for now, and the support of multiple daemons is not working yet...
