# The Junkins Archive

A private, password-protected VHS-themed page of family home movies, served at
**https://wesleyjunkins.com/archive** (this folder's `index.html` resolves there
natively). It is **not linked anywhere** on the main site — you reach it only by
typing the URL.

## How the security works

The video links are **never published in plaintext.** They live in `data.enc` as
ciphertext only. When a family member enters the password, the browser derives a
key from it (PBKDF2-SHA256, 600k iterations) and decrypts the blob with AES-256-GCM
(`crypto.js`). A wrong password fails the authentication check and decrypts nothing
— so there's no password hash stored and nothing to leak from the page source.

**The password is the entire protection.** Because the encrypted blob is public,
anyone could try to brute-force it offline. Use a real passphrase (10+ chars, not a
dictionary word) and share it with family privately.

### Files in this folder

| File | Committed? | Contains |
|------|-----------|----------|
| `index.html` / `style.css` / `app.js` | yes | The VHS page + decrypt + CRT player. **No links.** |
| `crypto.js` | yes | Shared encrypt/decrypt (used by the page and the tool). |
| `data.enc` | yes | The encrypted blob (ciphertext only). |
| `encrypt.html` | yes | Local tool to produce the blob. Holds no secrets. |
| `data.example.json` | yes | Empty template showing the list format. |
| `data.source.json` | **NO — git-ignored** | Your real plaintext list. Keep it locally. |

> The current `data.enc` is a **demo** (password `demo-archive-pass`, with sample
> public videos) so you can test the page. Replace it with your real list + password
> via `encrypt.html` before going live.

## Adding or updating videos

1. Upload the home movie to YouTube as **Unlisted** (anyone with the link can watch)
   or **Private** (only invited Google accounts — strongest, but each family member
   must be invited individually). Make sure embedding is allowed if you want the
   in-page CRT player to work.
2. Edit your local `data.source.json` (copy `data.example.json` to start).
3. Open `encrypt.html` from a local server (e.g. `python3 -m http.server` in the repo
   root, then visit `http://localhost:8000/archive/encrypt.html` — `file://` blocks
   the example loader and clipboard).
4. Paste your list into box ①, enter the archive password, click **Encrypt**.
5. Save/download the output as `data.enc` (overwrite the existing one) and commit.

### Data format

```json
{
  "folders": [
    {
      "name": "Beach Vacation 2010",
      "items": [
        { "name": "Part 1", "url": "https://www.youtube.com/watch?v=XXXX", "type": "video" }
      ]
    }
  ]
}
```

- `name` (folder): the collection title shown on the tape label. If it contains a
  4-digit year, that year is shown as the OSD timestamp on each clip.
- `items[].name`: label under the thumbnail.
- `items[].url`: the unlisted YouTube link (or an image URL).
- `items[].type`: `"video"` or `"image"`.

## Changing the password

Re-encrypt the list with the new password in `encrypt.html` and commit the new
`data.enc`. There is no separate password file.

## Notes / caveats

- A page refresh re-prompts for the password (the decrypted list is kept only in
  memory). This is intentional.
- The in-page player embeds via `youtube-nocookie.com`; a wrong/blocked embed falls
  back to the `↗ YT` link in the player bar.
- This is genuine encryption, but it is still a static site. For the strongest
  protection, combine it with **Private** YouTube videos.
