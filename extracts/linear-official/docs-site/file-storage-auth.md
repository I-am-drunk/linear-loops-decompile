# File storage auth — facts from linear.app/developers/file-storage-authentication (fetched 2026-09-27)

Source: https://linear.app/developers/file-storage-authentication

- Uploaded files are served from `https://uploads.linear.app/...` and REQUIRE
  auth: pass the same `Authorization` header as for GraphQL requests.
- Alternative for clients that cannot set headers on asset loads: send the
  request header `public-file-urls-expire-in: <seconds>` on GraphQL calls;
  all file URLs in that response come back pre-signed with a signature valid
  for that many seconds ("temporary access to the file").
- (For us: run transcripts embedding Linear-hosted images must either proxy
  with the auth header server-side or request pre-signed URLs — a bare <img>
  against uploads.linear.app from our UI will 403.)
