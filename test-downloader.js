#!/usr/bin/env node
/**
 * Test script to check if downloader services are working
 * Usage: node test-downloader.js <videoId>
 */

// Use native fetch (Node 18+) or node-fetch
const fetch = globalThis.fetch || (await import('node-fetch')).default;

const videoId = process.argv[2] || 'DJ3MytT2Ro4'; // Default to the Shorts video

console.log(`Testing downloaders for video: ${videoId}\n`);

// Test Python service
async function testPythonService() {
  const url = process.env.PYTHON_DOWNLOADER_URL || 'http://localhost:8000';
  console.log(`1. Testing Python service at ${url}...`);
  
  try {
    const response = await fetch(`${url}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.downloadUrl) {
        console.log(`   ✅ SUCCESS! Got download URL: ${data.downloadUrl.substring(0, 80)}...`);
        return true;
      }
    }
    console.log(`   ❌ Failed: ${response.status} ${response.statusText}`);
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    if (err.code === 'ECONNREFUSED') {
      console.log(`   💡 Tip: Make sure Python service is running: npm run python:service`);
    }
  }
  return false;
}

// Test VidsSave
async function testVidsSave() {
  console.log(`2. Testing VidsSave...`);
  try {
    const response = await fetch('https://vidssave.com/yt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
    });
    
    if (response.ok) {
      const html = await response.text();
      if (html.includes('.mp4') || html.includes('download')) {
        console.log(`   ✅ SUCCESS! VidsSave responded`);
        return true;
      }
    }
    console.log(`   ❌ Failed: ${response.status}`);
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
  return false;
}

async function main() {
  const results = {
    python: await testPythonService(),
    vidsSave: await testVidsSave(),
  };
  
  console.log(`\n📊 Results:`);
  console.log(`   Python service: ${results.python ? '✅ Working' : '❌ Not working'}`);
  console.log(`   VidsSave: ${results.vidsSave ? '✅ Working' : '❌ Not working'}`);
  
  if (!results.python && !results.vidsSave) {
    console.log(`\n💡 Recommendations:`);
    console.log(`   1. Start Python service: npm run python:service`);
    console.log(`   2. Set PYTHON_DOWNLOADER_URL in Supabase Edge Function settings`);
    console.log(`   3. For local testing, use ngrok: ngrok http 8000`);
  }
}

main().catch(console.error);

