# Knowledge Bank Assistant

A browser-based AI chatbot prototype for searching and analyzing uploaded knowledge sources.

## Features

- Chat interface for asking questions across indexed knowledge
- Knowledge Library with password-restricted access
- Upload support for Excel, Word, and PDF documents
- Full-document OCR support for scanned/image-based PDF reports
- Google Drive folder connection prototype
- Source-grounded answers with citations
- Document-aware answer synthesis for broad and specific questions
- Full report breakdowns with simplified summaries
- Recent question search and cleanup
- Persistent local browser state for uploads, deleted files, Drive folders, and recent questions

## Run Locally

Open `index.html` directly in a browser, or serve the folder with any static file server.

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## Deploy

This version includes a small Node server so every user shares the same Knowledge Library.

Deploy it to Render as a Web Service.

- Build command: leave blank
- Start command: `npm start`

## Prototype Notes

The server stores the shared Knowledge Library in `data/library.json`. On Render, attach a persistent disk or set `DATA_FILE` to a persistent path if you want the library to survive service restarts and redeploys. Production use would also need real authentication, secure document processing, Google OAuth, and server-side AI analysis.
