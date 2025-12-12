#!/usr/bin/env node

require('dotenv').config();
const { google } = require('googleapis');

async function testDriveAccess() {
  console.log('Testing Google Drive access...\n');

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  console.log('Service Account:', credentials.client_email);
  console.log('Folder ID:', folderId);
  console.log();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const authClient = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  try {
    // Test 1: Lire les infos du dossier
    console.log('1. Testing folder access...');
    const folder = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, capabilities',
    });
    console.log('✅ Folder accessible:', folder.data.name);
    console.log('   Capabilities:', JSON.stringify(folder.data.capabilities, null, 2));
    console.log();

    // Test 2: Lister les fichiers du dossier
    console.log('2. Listing files in folder...');
    const files = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id, name)',
    });
    console.log(`✅ Found ${files.data.files.length} files in folder`);
    files.data.files.forEach(f => console.log(`   - ${f.name} (${f.id})`));
    console.log();

    // Test 3: Créer un fichier test
    console.log('3. Creating test file...');
    const testFile = await drive.files.create({
      requestBody: {
        name: 'test-file.json',
        mimeType: 'application/json',
        parents: [folderId],
      },
      media: {
        mimeType: 'application/json',
        body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
      },
      fields: 'id, name',
    });
    console.log('✅ Test file created:', testFile.data.name, '(', testFile.data.id, ')');
    console.log();

    // Test 4: Supprimer le fichier test
    console.log('4. Deleting test file...');
    await drive.files.delete({ fileId: testFile.data.id });
    console.log('✅ Test file deleted');
    console.log();

    console.log('✅ All tests passed! Google Drive is working correctly.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testDriveAccess();
