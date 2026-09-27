# File storage authentication — facts from linear.app/developers/file-storage-authentication (fetched 2026-09-27)

Source: https://linear.app/developers/file-storage-authentication

- Uploaded files live at `https://uploads.linear.app/...`; auth REQUIRED to
  read them: the same `Authorization` header as GraphQL requests.
- Alternative: send request header `public-file-urls-expire-in: <seconds>` on
  GraphQL calls and all file URLs in the response come back pre-signed with
  that lifetime (no Authorization needed to fetch them until expiry).
