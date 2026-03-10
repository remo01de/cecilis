/**
 * Test-Skript: OpenAI Bildgenerierung
 * Prüft ob der API Key funktioniert und Bilder generiert werden können
 */

import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

// .env laden
dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ Fehler: OPENAI_API_KEY nicht in .env gefunden!');
  console.log('   Bitte stelle sicher, dass cecilia-chat/.env existiert und OPENAI_API_KEY enthält.');
  process.exit(1);
}

console.log('✅ API Key gefunden:', apiKey.slice(0, 10) + '...' + apiKey.slice(-4));
console.log('🎨 Teste Bildgenerierung mit OpenAI...\n');

const openai = new OpenAI({ apiKey });

const testPrompt = 'A beautiful anime-style fairy girl named Cecilia, age 17-19, with long flowing pastel-colored hair adorned with small flowers and magical sparkles, large expressive eyes, delicate translucent fairy wings, wearing a cute sporty outfit with pastel-colored hoodie and sneakers, serene crystal clear lake at sunset, lily pads, reflections, weeping willow trees, winking mischievously, tongue out slightly, fun energetic pose, high quality detailed anime illustration, soft pastel color palette, magical atmosphere, beautiful lighting, 4k';

async function testImageGeneration() {
  try {
    console.log('📤 Sende Anfrage an OpenAI Images API...');
    console.log('   Prompt:', testPrompt);
    console.log('   Modell: gpt-image-1 (gibt Base64 zurück)\n');

    const response = await openai.images.generate({
      model: 'gpt-image-1.5',
      prompt: testPrompt,
      n: 1,
      size: '1024x1024'
    });

    const b64Data = response.data?.[0]?.b64_json;
    const imageUrl = response.data?.[0]?.url;

    if (b64Data) {
      // Bild als Datei speichern
      const outputPath = path.join(process.cwd(), 'test-image.png');
      fs.writeFileSync(outputPath, Buffer.from(b64Data, 'base64'));

      console.log('✅ Erfolg! Bild wurde generiert und gespeichert.');
      console.log('📁 Datei:', outputPath);
      console.log('📊 Größe:', (b64Data.length * 0.75 / 1024).toFixed(1), 'KB');
      console.log('\n💡 Der API Key funktioniert korrekt für Bildgenerierung.');
      console.log('💡 Hinweis: gpt-image-1 gibt Base64-Daten statt URLs zurück.');

    } else if (imageUrl) {
      console.log('✅ Erfolg! Bild-URL erhalten:');
      console.log('🔗 URL:', imageUrl);

    } else {
      console.error('\n❌ Weder Base64 noch URL in der Antwort.');
      console.log('   Antwort:', JSON.stringify(response.data, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Fehler bei der Bildgenerierung:');
    console.error('   Status:', error.status);
    console.error('   Nachricht:', error.message);

    if (error.status === 401) {
      console.log('\n💡 Der API Key ist ungültig oder abgelaufen.');
    } else if (error.status === 429) {
      console.log('\n💡 Rate limit erreicht – zu viele Anfragen.');
    } else if (error.status === 400) {
      console.log('\n💡 Ungültige Anfrage – möglicherweise wird das Modell nicht unterstützt.');
    }
  }
}

testImageGeneration();
