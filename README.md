# Knowledge Bank Assistant

A browser-based AI chatbot prototype for searching and analyzing uploaded knowledge sources.

## Features

- Chat interface for asking questions across indexed knowledge
- Knowledge Library with password-restricted access
- Upload support for Excel, Word, and PDF documents
- Google Drive folder connection prototype
- Source-grounded answers with citations
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

This is a static site and can be deployed to Render as a Static Site.

- Build command: leave blank
- Publish directory: `.`

## Prototype Notes

The current app stores data in browser local storage. Production use would need a backend for real authentication, shared storage, secure document processing, Google OAuth, and server-side AI analysis.
