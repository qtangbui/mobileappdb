// Check YouTube playlists for new videos and update playlist-meta.json
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.YOUTUBE_API_KEY;
const META_PATH = path.join(__dirname, "..", "data", "playlist-meta.json");

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

  const meta = JSON.parse(fs.readFileSync(META_PATH, "utf-8"));
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
    fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + "\n");
    console.log("\nplaylist-meta.json updated");
  } else {
    console.log("\nNo changes detected");
  }

  // Set GitHub Actions output
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    fs.appendFileSync(ghOutput, `changed=${changed}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
