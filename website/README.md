# APX RIDE public website

This directory contains the current public website as plain, editable HTML, CSS, JavaScript and image assets. It was imported from the separate local `public-website` repository so the website and portal can be reviewed together in the APX RIDE GitHub repository. The original local repository was not deleted or modified.

The site has no build dependency. To test locally, serve this directory with any static-file server; opening `index.html` directly may behave differently for absolute asset paths. For a future Cloudflare Pages deployment, set the repository root directory to `website` and the output directory to `.` (or deploy these files as static assets). Keep the portal deployment rooted at the repository root.

The booking form in `app.js` posts to the separately deployed staging gateway at `https://api-staging.apxride.com/api/public-booking-requests`. The gateway applies Turnstile and rate limiting before forwarding the request to the protected portal through a Worker service binding. The checked-in Turnstile key is Cloudflare's published always-pass test key and must be replaced with the production site key during cutover. Committing this directory does **not** publish the website.

Do not commit secrets, customer records, `.openai/hosting.json`, or generated Sites runtime files here. Keep image usage rights and the public content under review before production launch.
