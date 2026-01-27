const mongoose = require('mongoose');
require('dotenv').config();
const MarketplaceListing = require('../models/MarketplaceListing');
const sharp = require('sharp');

async function createThumbnail(base64Image, width = 400, quality = 60) {
  try {
    const matches = base64Image.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches) {
      console.log('Invalid base64 format');
      return base64Image;
    }
    
    const imageBuffer = Buffer.from(matches[2], 'base64');
    const compressedBuffer = await sharp(imageBuffer)
      .resize(width, null, { withoutEnlargement: true, fit: 'inside' })
      .jpeg({ quality, progressive: true })
      .toBuffer();
    
    const compressedBase64 = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
    const originalSize = base64Image.length;
    const compressedSize = compressedBase64.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    console.log(`  Compressed: ${(originalSize/1024).toFixed(1)}KB -> ${(compressedSize/1024).toFixed(1)}KB (${ratio}% reduction)`);
    return compressedBase64;
  } catch (error) {
    console.error('  Error creating thumbnail:', error.message);
    return base64Image;
  }
}

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');
    
    const listings = await MarketplaceListing.find({ 
      $or: [
        { thumbnail: { $exists: false } }, 
        { thumbnail: null }, 
        { thumbnail: '' }
      ],
      images: { $exists: true, $ne: [] }
    });
    
    console.log(`Found ${listings.length} listings without thumbnails\n`);
    
    let processed = 0;
    for (const listing of listings) {
      if (listing.images && listing.images.length > 0) {
        console.log(`Processing: ${listing.name}`);
        const thumbnail = await createThumbnail(listing.images[0]);
        await MarketplaceListing.findByIdAndUpdate(listing._id, { thumbnail });
        processed++;
        console.log(`  Done (${processed}/${listings.length})\n`);
      }
    }
    
    console.log(`\nMigration complete! Processed ${processed} listings.`);
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
