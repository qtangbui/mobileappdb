// Check YouTube playlists for new videos across all app folders
const fs = require("fs");
const path = require("path");
const API_KEY = process.env.YOUTUBE_API_KEY;
const DATA_DIR = path.join(__dirname, "..", "data");

async function getPlaylistInfo(playlistId) {
  // Get playlist item count
  const listUrl = `https://www.googleapis.com/youtube/v3/playlists?part=contentDetails&id=${playlistId}&key=${API_KEY}`;
  const listRes = await fetch(listUrl);
  if (!listRes.ok) throw new Error(`Playlists API error: ${listRes.status}`);
  const listData = await listRes.json();
  const videoCount = listData.items?.[0]?.contentDetails?.itemCount || 0;

  // Get latest video title
  const itemsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=1&key=${API_KEY}`;
  const itemsRes = await fetch(itemsUrl);
  if (!itemsRes.ok) throw new Error(`PlaylistItems API error: ${itemsRes.status}`);
  const itemsData = await itemsRes.json();
  const latestTitle = itemsData.items?.[0]?.snippet?.title || "";

  return { videoCount, latestTitle };
}

async function main() {
  if (!API_KEY) {
    console.error("YOUTUBE_API_KEY not set");
    process.exit(1);
  }

  let anyChanged = false;

  // Find all playlist-meta.json files in subdirectories
  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(DATA_DIR, entry.name, "playlist-meta.json");
    if (!fs.existsSync(metaPath)) continue;

    console.log(`\n=== ${entry.name} ===`);
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    if (!meta.playlists?.length) {
      console.log("  No playlists configured, skipping");
      continue;
    }

    let changed = false;
    for (const pl of meta.playlists) {
      console.log(`Checking playlist: ${pl.playlistId}`);
      const info = await getPlaylistInfo(pl.playlistId);
      console.log(`  Current: ${pl.videoCount} videos, Remote: ${info.videoCount} videos`);
      console.log(`  Latest: "${info.latestTitle}"`);

      if (info.videoCount !== pl.videoCount || info.latestTitle !== pl.latestTitle) {
        pl.videoCount = info.videoCount;
        pl.latestTitle = info.latestTitle;
        changed = true;
        console.log("  -> Updated!");
      } else {
        console.log("  -> No change");
      }
    }

    if (changed) {
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
      console.log(`${entry.name}/playlist-meta.json updated`);
      anyChanged = true;
    }
  }

  console.log(anyChanged ? "\nChanges detected" : "\nNo changes detected");

  // Set GitHub Actions output
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    fs.appendFileSync(ghOutput, `changed=${anyChanged}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
