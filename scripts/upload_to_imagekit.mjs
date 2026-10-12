import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

/* ========================================================
   BLACK PEARL · LADY ALICE
   Automated ImageKit Media Uploader & Supabase Synchronizer
   ======================================================== */

// 1. Load Environment Variables from .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const envVars = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        envVars[key] = val;
      }
    }
  }
  return envVars;
}

const env = loadEnv();
const privateKey = process.argv[2] || env.IMAGEKIT_PRIVATE_KEY || process.env.IMAGEKIT_PRIVATE_KEY;
const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!privateKey) {
  console.error('\n❌ [Error] ImageKit Private Key not provided.');
  console.log('\nUsage:');
  console.log('  1. Add IMAGEKIT_PRIVATE_KEY=your_private_key to your .env file');
  console.log('  OR');
  console.log('  2. Run: node scripts/upload_to_imagekit.mjs your_private_key\n');
  console.log('Find your Private Key in: https://imagekit.io/dashboard/developer/api-keys\n');
  process.exit(1);
}

// 2. Initialize Supabase Client
let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('⚡ Supabase client connected:', supabaseUrl);
} else {
  console.warn('⚠️ Supabase credentials not found in .env. Skipping database sync.');
}

// Metadata for curated occasions
const imageMetadata = {
  'proposal-sunset.jpg': { title: 'Sunset Proposals', category: 'romance', subtitle: 'A private bow dressed for two as Mumbai skyline turns golden' },
  'sailing-cruise.jpg': { title: 'Harbour & Coastal Sailing', category: 'sailing', subtitle: 'Active navigation past lighthouses and coastal horizons' },
  'engagement-ceremony.jpg': { title: 'Ring Ceremonies', category: 'romance', subtitle: 'Two families celebrating facing the Gateway silhouette' },
  'birthday-party.jpg': { title: 'Milestone Birthdays', category: 'parties', subtitle: 'Celebrate under golden fairy lights with champagne flutes' },
  'cocktail-party.jpg': { title: 'Cocktail & DJ Nights', category: 'parties', subtitle: 'Panoramic Mumbai harbour skyline with artisanal mixology' },
  'bachelorette-party.jpg': { title: 'Bachelorette Send-Off', category: 'parties', subtitle: 'Private DJ set and sunset toast with the bridal party' },
  'private-dining.jpg': { title: 'Anniversaries & Private Dinners', category: 'romance', subtitle: 'Chef-curated tasting on the illuminated open deck' },
  'corporate-gala.jpg': { title: 'Corporate Offsites & Galas', category: 'corporate', subtitle: 'Hosting global leadership with five-star maritime hospitality' },
  'brand-launch.jpg': { title: 'Luxury Brand Showcase', category: 'corporate', subtitle: 'Haute Horlogerie preview and private VIP salon at anchor' },
  'sunrise-yoga.jpg': { title: 'Sunrise Yoga & Wellness', category: 'wellness', subtitle: 'Early morning wellness and sound bowls on calm waters' },
  'festive-fireworks.jpg': { title: 'Festive Fireworks Nights', category: 'parties', subtitle: 'Front-row view of Mumbai festival lights from the sea' },
  'family-reunion.jpg': { title: 'Family Celebrations', category: 'parties', subtitle: 'Three generations gathered across open decks and staterooms' },
  'lady-alice-sunset-poster.jpg': { title: 'Arabian Sea Golden Hour Charter', category: 'sailing', subtitle: 'Sunset cruise sailing toward Alibaug coastal waters' },
  'lady-alice-lounge-deck.jpg': { title: 'Bespoke Lounge Deck', category: 'parties', subtitle: 'Curated ivory styling & panoramic lounge seating' },
  'lady-alice-turf-deck.jpg': { title: 'Emerald Turf Deck', category: 'wellness', subtitle: 'Barefoot cocktails with 360° Arabian Sea views' },
  'master-suite.jpg': { title: 'Master Stateroom Suite', category: 'romance', subtitle: 'Climate-controlled teak state cabin & private suite lounge' },
  'lady-alice-mumbai-night-skyline.jpg': { title: 'Gateway Skyline by Night', category: 'sailing', subtitle: 'Illuminated Gateway of India and Taj Mahal Palace backdrop' },
  'lady-alice-night.jpg': { title: 'Lady Alice Illuminated Underway', category: 'sailing', subtitle: 'Full luxury ship charter in Mumbai harbour' }
};

async function uploadFile(filePath, fileName) {
  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');

  const formData = new FormData();
  formData.append('file', base64Data);
  formData.append('fileName', fileName);
  formData.append('folder', '/assets/images');
  formData.append('useUniqueFileName', 'false');

  const authHeader = 'Basic ' + Buffer.from(privateKey + ':').toString('base64');

  const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: {
      Authorization: authHeader
    },
    body: formData
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || 'ImageKit upload failed');
  }

  return result;
}

async function run() {
  const imagesDir = path.resolve(process.cwd(), 'assets/images');
  if (!fs.existsSync(imagesDir)) {
    console.error('Directory not found:', imagesDir);
    process.exit(1);
  }

  const files = fs.readdirSync(imagesDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
  console.log(`\n🚀 Starting upload of ${files.length} images to ImageKit...\n`);

  let count = 0;
  for (const fileName of files) {
    const fullPath = path.join(imagesDir, fileName);
    process.stdout.write(`[${++count}/${files.length}] Uploading ${fileName}... `);

    try {
      const uploadRes = await uploadFile(fullPath, fileName);
      console.log(`✅ Success! (URL: ${uploadRes.url})`);

      // Sync into Supabase table gallery_images
      if (supabase) {
        const meta = imageMetadata[fileName] || {
          title: fileName.replace(/\.[^/.]+$/, '').replace(/-/g, ' '),
          category: 'sailing',
          subtitle: 'Lady Alice private celebration'
        };

        const { error } = await supabase.from('gallery_images').insert([{
          title: meta.title,
          subtitle: meta.subtitle,
          category: meta.category,
          imagekit_url: uploadRes.url,
          file_id: uploadRes.fileId,
          thumbnail_url: uploadRes.thumbnailUrl || uploadRes.url,
          created_at: new Date().toISOString()
        }]);

        if (error) {
          console.warn(`   ⚠️ Supabase save note: ${error.message}`);
        } else {
          console.log(`   ⚡ Stored in Supabase gallery_images!`);
        }
      }
    } catch (err) {
      console.error(`❌ Failed:`, err.message);
    }
  }

  console.log('\n🎉 Finished uploading all assets to ImageKit & Supabase!\n');
}

run();
