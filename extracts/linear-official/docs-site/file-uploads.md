# File uploads — facts from linear.app/developers/how-to-upload-a-file-to-linear (fetched 2026-09-27)

Source: https://linear.app/developers/how-to-upload-a-file-to-linear

- Uploaded files live in Linear's PRIVATE cloud storage; auth (OAuth/API key)
  is required to read them outside the app.
- Easiest path: put an image/video URL (or base64 data URI) inside markdown
  content of `issueCreate`/comment/document mutations — Linear ingests it into
  private storage automatically.
- Manual path (any file type): mutation `fileUpload(contentType, filename,
  size)` → `{ success, uploadFile: { uploadUrl, assetUrl, headers: [{key,
  value}] } }`; then HTTP **PUT** the bytes to `uploadUrl`.
  - The PUT MUST run server-side: Linear's CSP blocks client-side uploads
    (CORS error = you tried from a browser).
  - Copy EVERY header from `uploadFile.headers` onto the PUT (they come as an
    array of {key,value} pairs) plus `Content-Type` and
    `Cache-Control: public, max-age=31536000`; a 403 means headers were
    dropped.
  - `assetUrl` is the durable URL usable in later mutations.
